// ============================================================
// useSpeech - microphone capture + speech-to-text pipeline.
//
//   Microphone -> Audio capture -> (silence-based segmentation)
//   -> Speech recognition -> Transcript -> Question detection
//
// Three replaceable providers:
//   whisper : local recording, segments sent to OpenAI Whisper
//   browser : Web Speech API (when available)
//   mock    : emits sample questions offline
//
// Partial fragments are NEVER sent to the AI - only complete
// segments that pass question detection reach the caller.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeechProviderId, Language } from "@core/shared/types";
import { isLikelyQuestion } from "@core/classifier";
import { MOCK_QUESTIONS } from "@core/speech/provider";

export type SpeechStatus = "idle" | "listening" | "transcribing" | "error";

interface UseSpeechOptions {
  provider: SpeechProviderId;
  language: Language;
  onQuestion: (question: string) => void;
  onError: (message: string) => void;
}

// Voice-activity thresholds
const RMS_THRESHOLD = 0.02;
const SILENCE_MS = 1500; // pause length that ends a phrase
const MIN_VOICED_MS = 600; // minimum voiced time for a real phrase
const MAX_SEGMENT_MS = 30000; // force-cut very long segments
const CHECK_INTERVAL_MS = 200;

export function useSpeech({ provider, language, onQuestion, onError }: UseSpeechOptions) {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [listening, setListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");

  // refs to live resources so stop() can clean everything
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const mockTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const mockIndexRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const cbRef = useRef({ onQuestion, onError });
  cbRef.current = { onQuestion, onError };

  // ---------- shared emit ----------
  const emitTranscript = useCallback((text: string) => {
    const t = (text || "").trim();
    if (!t) return;
    setLastTranscript(t);
    if (isLikelyQuestion(t)) {
      cbRef.current.onQuestion(t);
    }
  }, []);

  // ---------- EMERGENCY STOP / cleanup ----------
  const stop = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    setStatus("idle");

    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (mockTimerRef.current) { window.clearTimeout(mockTimerRef.current); mockTimerRef.current = null; }

    try { recognitionRef.current?.stop?.(); } catch { /* ignore */ }
    recognitionRef.current = null;

    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
    } catch { /* ignore */ }
    recorderRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;

    chunksRef.current = []; // clear temporary audio buffers
  }, []);

  useEffect(() => stop, [stop]); // full cleanup on unmount
  useEffect(() => { if (listeningRef.current) stop(); }, [provider]); // provider switch stops capture

  // ---------- MOCK provider ----------
  const startMock = useCallback(() => {
    setStatus("listening");
    const emitNext = () => {
      if (!listeningRef.current) return;
      const q = MOCK_QUESTIONS[mockIndexRef.current % MOCK_QUESTIONS.length];
      mockIndexRef.current += 1;
      emitTranscript(q);
      mockTimerRef.current = window.setTimeout(emitNext, 14000);
    };
    mockTimerRef.current = window.setTimeout(emitNext, 1500);
  }, [emitTranscript]);

  // ---------- BROWSER provider (Web Speech API) ----------
  const startBrowser = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      stop();
      cbRef.current.onError(
        "Browser speech recognition is not available in this build. Switch the speech provider to Whisper or Mock in Settings."
      );
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = language === "Hindi" ? "hi-IN" : language === "Hinglish" ? "en-IN" : "en-US";

    rec.onresult = (evt: any) => {
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        if (evt.results[i].isFinal) {
          emitTranscript(evt.results[i][0].transcript);
        }
      }
    };
    rec.onerror = (evt: any) => {
      const code = evt?.error ?? "unknown";
      if (code === "no-speech") return; // benign
      stop();
      const msg =
        code === "not-allowed" || code === "service-not-allowed"
          ? "Microphone access was denied or the speech service is unavailable. Try the Whisper provider instead."
          : `Speech recognition failed (${code}). Try the Whisper provider in Settings.`;
      cbRef.current.onError(msg);
    };
    rec.onend = () => {
      // auto-restart while listening (API stops after silence)
      if (listeningRef.current && recognitionRef.current === rec) {
        try { rec.start(); } catch { /* ignore */ }
      }
    };

    try {
      rec.start();
      setStatus("listening");
    } catch (err: any) {
      stop();
      cbRef.current.onError(`Could not start speech recognition: ${err?.message ?? err}`);
    }
  }, [language, emitTranscript, stop]);

  // ---------- WHISPER provider (local VAD + segment upload) ----------
  const startWhisper = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err: any) {
      stop();
      const name = err?.name ?? "";
      cbRef.current.onError(
        name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access in Windows Settings > Privacy > Microphone."
          : name === "NotFoundError"
            ? "No microphone was found. Plug one in or switch the speech provider to Mock."
            : `Could not access the microphone: ${err?.message ?? err}`
      );
      return;
    }
    if (!listeningRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }

    streamRef.current = stream;
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    let voicedMs = 0;
    let silenceMs = 0;
    let segmentMs = 0;

    const newRecorder = () => {
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start(250);
      recorderRef.current = rec;
      voicedMs = 0;
      silenceMs = 0;
      segmentMs = 0;
    };

    const finalizeSegment = async () => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") return;
      const hadVoice = voicedMs >= MIN_VOICED_MS;

      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        try { rec.stop(); } catch { resolve(); }
      });
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];

      // restart capture for the next phrase immediately
      if (listeningRef.current) newRecorder();

      if (!hadVoice || blob.size < 2000) return;

      setStatus("transcribing");
      try {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const result = await window.api.speech.transcribe(bytes, mime);
        if (!listeningRef.current) return;
        if (result.ok && result.text) {
          emitTranscript(result.text);
        } else if (result.error && !/too short/i.test(result.error)) {
          cbRef.current.onError(result.error);
        }
      } catch (err: any) {
        cbRef.current.onError(`Transcription failed: ${err?.message ?? err}`);
      }
      if (listeningRef.current) setStatus("listening");
    };

    newRecorder();
    setStatus("listening");

    timerRef.current = window.setInterval(() => {
      if (!listeningRef.current) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      segmentMs += CHECK_INTERVAL_MS;

      if (rms > RMS_THRESHOLD) {
        voicedMs += CHECK_INTERVAL_MS;
        silenceMs = 0;
      } else {
        silenceMs += CHECK_INTERVAL_MS;
      }

      // End of phrase: enough voice followed by a pause - or a very long segment.
      if ((voicedMs >= MIN_VOICED_MS && silenceMs >= SILENCE_MS) || segmentMs >= MAX_SEGMENT_MS) {
        void finalizeSegment();
      }
    }, CHECK_INTERVAL_MS);
  }, [emitTranscript, stop]);

  // ---------- start/toggle ----------
  const start = useCallback(() => {
    if (listeningRef.current) return;
    listeningRef.current = true;
    setListening(true);
    if (provider === "mock") startMock();
    else if (provider === "browser") startBrowser();
    else void startWhisper();
  }, [provider, startMock, startBrowser, startWhisper]);

  const toggle = useCallback(() => {
    if (listeningRef.current) stop();
    else start();
  }, [start, stop]);

  return { status, listening, lastTranscript, start, stop, toggle };
}
