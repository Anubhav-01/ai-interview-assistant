// ============================================================
// MockProvider - works fully offline, no API key, no cost.
// Used for UI development, demos and testing.
// ============================================================

import type { BuiltPrompt } from "../shared/types";
import { AIProvider, AIGenerateOptions } from "./provider";

export class MockProvider implements AIProvider {
  readonly id = "mock";
  readonly label = "Mock (offline)";
  readonly isExternal = false;

  async generate(prompt: BuiltPrompt, opts: AIGenerateOptions = {}): Promise<string> {
    // Simulate a small delay so the UI states are visible.
    await sleep(500, opts.signal);

    const user = prompt.user;
    const type = matchField(user, "Question Type") ?? "GENERAL";
    const question = matchField(user, "Current Question") ?? "your question";
    const name = /Name:\s*(.+)/.exec(user)?.[1]?.trim() || "the candidate";

    switch (type) {
      case "CODING":
        return [
          "Approach:",
          "Use two pointers moving toward the center, swapping characters as we go.",
          "",
          "Code:",
          "```python",
          "def reverse_string(s: str) -> str:",
          "    chars = list(s)",
          "    left, right = 0, len(chars) - 1",
          "    while left < right:",
          "        chars[left], chars[right] = chars[right], chars[left]",
          "        left += 1",
          "        right -= 1",
          "    return ''.join(chars)",
          "```",
          "",
          "Time Complexity: O(n)",
          "Space Complexity: O(n) for the character list (O(1) extra swaps)",
          "",
          "(Mock answer - configure a real AI provider in Settings for actual answers.)",
        ].join("\n");

      case "SQL":
        return [
          "SQL Query:",
          "```sql",
          "SELECT d.department_name, MAX(e.salary) AS max_salary",
          "FROM employees e",
          "JOIN departments d ON d.department_id = e.department_id",
          "GROUP BY d.department_name;",
          "```",
          "",
          "Explanation: We join employees to departments, group rows per department, and take MAX(salary) within each group.",
          "",
          "(Mock answer - configure a real AI provider in Settings for actual answers.)",
        ].join("\n");

      case "INTRODUCTION":
        return `Sure. I'm ${name}, and my background is in software development. I enjoy building practical projects end to end, and I've been focusing on the skills listed in my resume that match this role. I'm excited about this position because it lines up well with what I've already been doing and where I want to grow. (Mock answer - configure a real AI provider in Settings.)`;

      case "BEHAVIORAL":
        return `In one of my projects, we hit a problem close to what you're describing. I took ownership of the issue, broke it into smaller pieces, and coordinated with my teammates on the fix. In the end we shipped on time and I learned a lot about communicating early when things go wrong. (Mock answer - configure a real AI provider in Settings.)`;

      case "FOLLOW_UP":
        return `Building on what I just mentioned - the biggest part of that was staying focused on the core problem and iterating quickly. I'd be happy to go deeper into any specific part. (Mock answer - configure a real AI provider in Settings.)`;

      default:
        return `Here's a concise way to answer "${truncate(question, 90)}": I'd keep it direct, connect it to my actual experience from my resume, and finish with why it's relevant to this role. (Mock answer for ${type} - configure a real AI provider in Settings for actual answers.)`;
    }
  }
}

function matchField(text: string, label: string): string | null {
  const re = new RegExp(`${label}:\\s*\\n?([\\s\\S]*?)(?:\\n\\n|$)`);
  const m = re.exec(text);
  return m ? m[1].trim() : null;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });
}
