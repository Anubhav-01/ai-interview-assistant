// ============================================================
// Question classifier.
// Fast, local keyword heuristics - no API call required.
// ============================================================

import type { QuestionType } from "../shared/types";

const RULES: Array<{ type: QuestionType; patterns: RegExp[] }> = [
  {
    type: "INTRODUCTION",
    patterns: [
      /tell (me|us) (something )?about yourself/i,
      /introduce yourself/i,
      /walk (me|us) through your (resume|cv|profile|background)/i,
      /(brief|short|quick) (intro|introduction)/i,
      /who are you/i,
    ],
  },
  {
    type: "SQL",
    patterns: [
      /\bsql\b/i,
      /\b(select|inner join|left join|right join|outer join|group by|having|subquer|cte|window functions?|order by)\b/i,
      /\b(second highest salary|nth highest|duplicate (rows|records))\b/i,
      /\bnormali[sz]ation\b/i,
      /\b(primary key|foreign key|indexing in (a )?database)\b/i,
      /write (a |the )?quer(y|ies)/i,
    ],
  },
  {
    type: "SYSTEM_DESIGN",
    patterns: [
      /\bdesign (a|an|the) (system|url shortener|chat|rate limiter|feed|notification|cache|scalable)/i,
      /\bsystem design\b/i,
      /\b(scalab(le|ility)|load balanc|horizontal scaling|sharding|microservices architecture|high availability|cap theorem|message queue)\b/i,
      /how would you (design|architect|scale)/i,
    ],
  },
  {
    type: "CODING",
    patterns: [
      /write (a |the )?(function|program|code|method|algorithm)/i,
      /\b(implement|solve)\b.*\b(function|algorithm|problem|linked list|array|string|tree|graph|stack|queue)\b/i,
      /\b(time complexity|space complexity|big[- ]?o)\b/i,
      /\b(reverse a string|fibonacci|palindrome|binary search|sorting algorithm|two pointers|sliding window|recursion)\b/i,
      /\b(leetcode|dsa)\b/i,
      /\bcode\b.*\b(in|using)\b.*\b(c\+\+|java|python|javascript|c)\b/i,
    ],
  },
  {
    type: "BEHAVIORAL",
    patterns: [
      /tell (me|us) about a time/i,
      /describe a (situation|time|challenge|conflict)/i,
      /give (me |us )?an example of/i,
      /how (did|do) you handle (a |an )?(conflict|pressure|stress|deadline|failure|disagreement|criticism)/i,
      /\b(biggest challenge|difficult situation|worked in a team|team conflict|missed (a )?deadline|failure you)/i,
      /how do you (deal|cope) with/i,
    ],
  },
  {
    type: "HR",
    patterns: [
      /why should we hire/i,
      /why (do you want|are you interested in) (this|the) (job|role|position|company)/i,
      /why (this|our) company/i,
      /\b(strengths?|weakness(es)?)\b/i,
      /where do you see yourself/i,
      /\b(salary|compensation|notice period|relocat|work from home|expectations?)\b/i,
      /why should we hire a fresher/i,
      /are you willing to/i,
      /(hobbies|interests) outside/i,
      /do you have any questions for (me|us)/i,
    ],
  },
  {
    type: "PROJECT",
    patterns: [
      /\bprojects?\b/i,
      /what (have you|did you) (built|build|made|make|developed|develop)/i,
      /\bfinal[- ]year project\b/i,
    ],
  },
  {
    type: "RESUME",
    patterns: [
      /\b(your )?(resume|cv)\b/i,
      /\b(your )?(education|degree|college|university|cgpa|gpa|academics)\b/i,
      /\b(your )?(internship|previous (company|job|role)|work experience|current (company|role))\b/i,
      /\bcertifications?\b/i,
      /\bachievements?\b/i,
    ],
  },
  {
    type: "TECHNICAL",
    patterns: [
      /what (is|are)\b/i,
      /difference between/i,
      /explain\b/i,
      /how (does|do|is|are)\b/i,
      /\b(oop|api|rest|http|css|html|react|node|java|python|javascript|typescript|database|dbms|os|operating system|networking|thread|process|memory|compiler|framework|library|cloud|docker|kubernetes|git|machine learning|ai)\b/i,
      /\bdefine\b/i,
      /advantages? (and|or) disadvantages?/i,
      /when would you use/i,
    ],
  },
];

const FOLLOW_UP_PATTERNS: RegExp[] = [
  /^(and|so|but|ok(ay)?[,.]?|then)\b/i,
  /\b(that|this|it|those|these|there)\b.*\?/i,
  /can you (elaborate|expand|explain (more|further|that))/i,
  /tell me more/i,
  /^what (about|was|were) (the|your|its?|that|this)/i,
  /^(why|how|when|where)\??$/i,
  /\b(biggest|main|hardest) (challenge|problem|difficulty|issue)\b/i,
  /^how did you (do|handle|solve|build|test|deploy) (it|that|this)/i,
  /^anything else/i,
  /^(what|which) (technologies|tools|stack) did you use/i,
];

/**
 * Classify a question into a QuestionType.
 * @param question the question text
 * @param hasHistory whether previous Q&A exists in the session (enables FOLLOW_UP)
 */
export function classifyQuestion(
  question: string,
  hasHistory = false
): QuestionType {
  const q = (question || "").trim();
  if (!q) return "GENERAL";

  // Follow-up detection: short, referential questions right after a previous answer.
  if (hasHistory) {
    const words = q.split(/\s+/).length;
    const isFollowUp = FOLLOW_UP_PATTERNS.some((p) => p.test(q));
    if (isFollowUp && words <= 14) {
      // A follow-up about SQL/coding should still get the specialized prompt.
      const specialized = matchType(q, ["SQL", "CODING", "SYSTEM_DESIGN"]);
      return specialized ?? "FOLLOW_UP";
    }
  }

  return matchType(q) ?? "GENERAL";
}

function matchType(q: string, only?: QuestionType[]): QuestionType | null {
  for (const rule of RULES) {
    if (only && !only.includes(rule.type)) continue;
    if (rule.patterns.some((p) => p.test(q))) return rule.type;
  }
  return null;
}

/**
 * Heuristic: is this transcript chunk a meaningful interviewer question
 * (vs. noise / partial fragment)?
 */
export function isLikelyQuestion(text: string): boolean {
  const t = (text || "").trim();
  if (t.length < 8) return false;
  const words = t.split(/\s+/).length;
  if (words < 2) return false;
  if (/\?\s*$/.test(t)) return true;
  if (
    /^(what|why|how|when|where|which|who|can|could|do|does|did|are|is|was|were|have|has|tell|describe|explain|walk|give|share|would|will|should|define|write|implement|design|solve|introduce)\b/i.test(
      t
    )
  ) {
    return true;
  }
  // Imperative interviewer phrasing
  if (/\b(tell me|explain|describe|walk me through|talk about|elaborate)\b/i.test(t)) {
    return true;
  }
  return false;
}
