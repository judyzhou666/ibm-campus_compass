import type { Constraints } from "./types.ts";
import { TOPICS, DAYS } from "./data.ts";

export function validateConstraints(
  value: unknown,
): asserts value is Constraints {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid constraints");
  const c = value as Record<string, unknown>;
  const fields = [
    "explore",
    "topics",
    "excluded",
    "days",
    "after",
    "before",
    "food",
    "free",
    "limit",
  ];
  if (Object.keys(c).some((key) => !fields.includes(key)))
    throw new Error("Unknown constraint field");
  const integer = (n: unknown, min: number, max: number) =>
    typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
  if (
    (c.days !== undefined &&
      (!Array.isArray(c.days) ||
        c.days.length > 7 ||
        c.days.some((d) => !integer(d, 0, 6)))) ||
    (c.after !== undefined && !integer(c.after, 0, 1440)) ||
    (c.before !== undefined && !integer(c.before, 0, 1440)) ||
    (c.limit !== undefined && !integer(c.limit, 1, 5))
  )
    throw new Error("Invalid day, time, or event limit");
  for (const topics of [c.topics, c.excluded]) {
    if (
      topics !== undefined &&
      (!Array.isArray(topics) ||
        topics.length > TOPICS.length ||
        topics.some((t) => typeof t !== "string" || !TOPICS.includes(t)))
    )
      throw new Error("Unknown interest category");
  }
  if (
    c.food !== undefined &&
    (typeof c.food !== "string" ||
      !["Free meal", "Coffee & snacks"].includes(c.food))
  )
    throw new Error("Unknown food preference");
  if (c.explore !== undefined && typeof c.explore !== "boolean")
    throw new Error("Invalid exploration choice");
  if (c.free !== undefined && typeof c.free !== "boolean")
    throw new Error("Invalid free-admission preference");
}

const keywords = {
  "AI & education": /\b(ai|education|research|learning|tech|coding|data)\b/i,
  Career: /\b(career|job|industry|alumni|networking|resume|professional)\b/i,
  Social: /\b(social|friend|friends|meet|people|dinner|lunch|community)\b/i,
  "Arts & culture":
    /\b(art|arts|culture|cultural|film|museum|creative|sketch|ceramics)\b/i,
  Wellbeing: /\b(wellbeing|wellness|relax|mindful|movement|quiet|balance)\b/i,
};
export class PlanningClarification extends Error {
  constructor(
    message: string,
    readonly constraints: Constraints,
    readonly clocks: string[],
    readonly restatement = false,
  ) {
    super(message);
  }
}
export function interpretRequest(
  text: string,
  previous: Constraints = {},
): {
  constraints: Constraints;
  understood: boolean;
  clarification?: string;
  clocks?: string[];
  restatement?: boolean;
} {
  validateConstraints(previous);
  if (!text.trim() || new TextEncoder().encode(text).length > 2000)
    throw new Error("Message must contain 1–2000 bytes");
  const q = text.toLowerCase();
  const budgetText = q.replace(
    /\b(?:at most|up to|no more than)\s+[1-5]\s+(?:events|options|choices)\b/g,
    "",
  );
  if (
    /\$|\b(?:under|less than|at most|up to|no more than|budget(?: of)?)\s*-?\d|\b\d+(?:\.\d+)?\s*(?:dollars?|usd|euros?)\b/.test(
      budgetText,
    )
  )
    throw new Error(
      "Numeric budgets are not supported. Please restate your complete request with ‘free admission’ if required, or omit the budget. No budget-filtered plan was generated.",
    );
  let understood = /\b(plan|events?|week|options|choices)\b/.test(q);
  const test = (pattern: RegExp) => {
    const found = pattern.test(q);
    understood ||= found;
    return found;
  };
  let c = { ...previous };
  if (test(/\b(reset|start over)\b/)) c = {};
  if (test(/\b(reset|start over|any time|any day)\b/)) {
    delete c.days;
    delete c.after;
    delete c.before;
    delete c.food;
    delete c.free;
    delete c.excluded;
  }
  const topics = Object.entries(keywords)
    .filter(([k, re]) => test(re))
    .map(([k]) => k);
  const excluded = Object.entries(keywords)
    .filter(([k, re]) =>
      test(
        new RegExp(
          `(?:no|not|avoid|without)\\s+(?:any\\s+)?(?:${re.source.replace(/\\b/g, "")})`,
          "i",
        ),
      ),
    )
    .map(([k]) => k);
  if (topics.length) {
    c.topics = topics.filter((t) => !excluded.includes(t));
    delete c.explore;
  }
  if (excluded.length) c.excluded = excluded;
  const days = DAYS.map((d, i) =>
    test(new RegExp(`\\b${d.toLowerCase()}(?:day|sday|nesday|rsday)?\\b`))
      ? i
      : -1,
  ).filter((i) => i >= 0);
  if (days.length) c.days = days;
  if (test(/\bweekend|saturday|sunday\b/)) c.days = [5, 6];
  if (test(/\bweekday/)) c.days = [0, 1, 2, 3, 4];
  if (test(/\bafternoon/)) {
    c.after = 720;
    c.before = 1020;
  }
  if (test(/\bevening/)) {
    c.after = 1020;
    delete c.before;
  }
  if (test(/\bmorning/)) {
    c.before = 720;
    delete c.after;
  }
  for (const type of ["after", "before"] as const) {
    const m = q.match(
      new RegExp(`\\b${type}\\s+(\\d+)(?::(\\d+))?\\s*(am|pm)?\\b`),
    );
    if (m) {
      understood = true;
      let h = +m[1];
      const invalidHour = !!m[3] && (h < 1 || h > 12);
      if (m[3] === "pm" && h < 12) h += 12;
      if (m[3] === "am" && h === 12) h = 0;
      if (!m[3] && h < 8) h += 12;
      const minute = +(m[2] || 0);
      c[type] =
        invalidHour ||
        h > 23 ||
        minute > 59 ||
        (m[2] !== undefined && m[2].length !== 2)
          ? 1441
          : h * 60 + minute;
    }
  }
  if (test(/\b(free food|free meal|meal|dinner|lunch)\b/)) c.food = "Free meal";
  if (test(/\b(coffee|tea|snack|refreshment)/) && !c.food)
    c.food = "Coffee & snacks";
  if (test(/\b(free|no cost|no-cost|zero budget)\b/)) c.free = true;
  if (test(/\b(any food|food doesn.t matter|no food preference)\b/))
    delete c.food;
  const n = q.match(/\b([1-5])\s+(?:events|choices|options)/);
  if (n) {
    understood = true;
    c.limit = +n[1];
  }
  validateConstraints(c);
  const ambiguous = [
    ...q.matchAll(/\b(after|before)\s+(\d+)(?::(\d+))?\s*(am|pm)?\b/g),
  ].filter((m) => !m[4] && +m[2] >= 1 && +m[2] <= 12);
  const clocks = ambiguous.map((m) => m[0].trim());
  for (const m of ambiguous) delete c[m[1] as "after" | "before"];
  const ambiguousClock = clocks.length > 0;
  const restatement =
    /\b(near me|nearby|cheap|sometime|not (?:on )?(?:monday|tuesday|wednesday|thursday|friday)|cannot do|can.t do)\b/.test(
      q,
    );
  if (restatement) delete c.days;
  const clarification = restatement
    ? "Please restate your complete request with the topic, weekdays you CAN attend, and AM/PM for every time. I cannot infer location or weekday exclusions. For cost, only free admission is supported; numeric budgets are not supported."
    : ambiguousClock
      ? "Do you mean AM or PM? Please include AM/PM, or use an unambiguous 24-hour time."
      : undefined;
  return { constraints: c, understood, clarification, clocks, restatement };
}
