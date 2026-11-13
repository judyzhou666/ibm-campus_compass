import type { Constraints } from "./types.ts";
import { TOPICS, DAYS } from "./data.ts";
import { outsideWeekMessage, parseDemoDates } from "./demoDates.ts";

export function validateConstraints(
  value: unknown,
): asserts value is Constraints {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid constraints");
  const c = value as Record<string, unknown>;
  const fields = [
    "topics",
    "excluded",
    "days",
    "after",
    "before",
    "food",
    "free",
    "limit",
    "focus",
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
      !["Free meal", "Coffee & snacks", "Paid food", "None", "Unknown"].includes(c.food))
  )
    throw new Error("Unknown food preference");
  if (c.free !== undefined && typeof c.free !== "boolean")
    throw new Error("Invalid free-admission preference");
  if (
    c.focus !== undefined &&
    (!Array.isArray(c.focus) ||
      c.focus.length > 12 ||
      c.focus.some(
        (t) =>
          typeof t !== "string" ||
          t.length > 40 ||
          !/^[a-z]+(?: [a-z]+)*$/.test(t),
      ))
  )
    throw new Error("Invalid focus terms");
}

/**
 * Words from the request that picked its topics ("ai", "education"). The planner
 * ranks events that mention them first. Words that only name a whole category
 * ("career", "social") are left out. Mirrored in backend/src/interpreter.rs.
 */
function focusTerms(q: string, excluded: string[]) {
  const terms: string[] = [];
  for (const [topic, re] of Object.entries(keywords)) {
    if (excluded.includes(topic)) continue;
    for (const m of q.matchAll(new RegExp(re.source, "gi"))) {
      const term = m[0].toLowerCase().replace(/\s+/g, " ");
      // A word that names the whole category ("career") does not narrow it.
      if (term === topic.toLowerCase()) continue;
      if (!terms.includes(term) && terms.length < 12) terms.push(term);
    }
  }
  return terms;
}

const keywords = {
  "AI & education": /\b(ai|education|research|learning|tech|coding|data|edtech|ed\s+tech|phd|doctoral|doctorate|grad(?:uate)?\s+school|academics?|thesis|dissertation|seminars?|teaching|pedagogy|professors?|faculty)\b/i,
  Career: /\b(career|jobs?|internships?|industry|alumni|networking|resume|professional|work experience|hiring|find\s+(?:a\s+)?(?:job|internship|work)|get\s+(?:a\s+)?job|land\s+(?:a\s+)?(?:job|internship)|cpt|^opt$|(?:for|about|on|with|stem|my)\s+opt|opt\s+(?:application|status|visa|extension|eligibility|employment|jobs?|questions?|timeline|workshop|session)|visa|sponsorship|employers?|recruit(?:ing|ers?)|interviews?|cv|job\s+fair|mentors?|mentorship)\b/i,
  Social: /\b(social|friends?|meet|people|dinner|lunch|community|language exchange|practice\s+(?:my\s+|some\s+|their\s+)?english|make\s+(?:some\s+|new\s+)?friends?|meet\s+(?:some\s+|new\s+|other\s+)?people|talk\s+to\s+(?:new\s+|other\s+)?people|international|clubs?|party|parties|games?|trivia|hang\s+out|mixer)\b/i,
  "Arts & culture":
    /\b(art|arts|culture|cultural|film|museum|creative|sketch|ceramics|music|concerts?|painting|drawing|theat(?:er|re)|photography|crafts?)\b/i,
  Wellbeing: /\b(wellbeing|wellness|relax|mindful|movement|quiet|balance|stress|mental\s+health|yoga|meditation|exercise|fitness|run|running|sleep|burnout)\b/i,
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
          // Word boundaries on both ends, so "not optional" or "cannot" do
          // not count as excluding a topic. Mirrored in interpreter.rs.
          `\\b(?:no|not|avoid|without)\\s+(?:any\\s+)?(?:${re.source.replace(/\\b/g, "")})\\b`,
          "i",
        ),
      ),
    )
    .map(([k]) => k);
  if (topics.length) {
    c.topics = topics.filter((t) => !excluded.includes(t));
    const focus = focusTerms(q, excluded);
    if (focus.length) c.focus = focus;
    else delete c.focus;
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
  // Month-day dates ("Nov 6-12") override weekday words and are limited to the demo week.
  const dates = parseDemoDates(q);
  let outsideWeek: string | undefined;
  if (dates) {
    understood = true;
    if (dates.days.length) c.days = dates.days;
    else outsideWeek = outsideWeekMessage(dates.requested);
  }
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
  if (test(/\b(free food|free meal|free lunch|free dinner|free snacks|free coffee|free pizza|free breakfast|meal|dinner|lunch)\b/)) c.food = "Free meal";
  if (test(/\b(coffee|tea|snack|refreshment)/) && !c.food)
    c.food = "Coffee & snacks";
  if (test(/\b(paid food|buy food|food for sale|food available for purchase)\b/) && !c.food)
    c.food = "Paid food";
  if (test(/\b(no food|food-free|without food)\b/) && !c.food)
    c.food = "None";
  if (test(/\b(unknown food|food (is |not )?(un)?confirmed|food status unknown)\b/) && !c.food)
    c.food = "Unknown";
  // "free" next to an event or topic word means FREE ADMISSION (e.g. "free ceramics",
  // "ceramics free on Wednesday", "free workshops"). "free" describing the *person's*
  // availability sets no cost filter (e.g. "I'm free", "free time", "I'm only free Friday").
  // "free food/meal/…" is already handled above (food filter only).
  //
  // Person-availability forms: subject + optional adverb + "free"
  //   "I'm free", "I am free", "I'm only free", "when I'm free", "free time/slot/period/hour"
  const isPersonFree =
    /\b(?:i(?:'m| am)|we(?:'re| are)|you(?:'re| are)|they(?:'re| are))(?:\s+\w+)?\s+free\b/i.test(q) ||
    /\bwhen\s+(?:i(?:'m| am)|you(?:'re| are))\s+free\b/i.test(q) ||
    /\bif\s+(?:i(?:'m| am)|you(?:'re| are))\s+free\b/i.test(q) ||
    /\bfree\s+(?:time|slot|period|hour|day)\b/i.test(q);
  const hasFree = /\bfree\b/i.test(q);
  if (hasFree && !isPersonFree && !c.food) {
    // "free" next to a topic/event word → free admission
    understood = true;
    c.free = true;
  }
  // Explicit free-admission phrases set free even when food is also mentioned.
  if (
    test(
      /\b(free admission|free entry|free to attend|free of charge|no cost|no-cost|costs? nothing|without paying|zero cost|zero budget)\b/,
    )
  )
    c.free = true;
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
  const clarification = outsideWeek
    ? outsideWeek
    : restatement
    ? "Please restate your complete request with the topic, weekdays you CAN attend, and AM/PM for every time. I cannot infer location or weekday exclusions. For cost, only free admission is supported; numeric budgets are not supported."
    : ambiguousClock
      ? "Do you mean AM or PM? Please include AM/PM, or use an unambiguous 24-hour time."
      : undefined;
  return { constraints: c, understood, clarification, clocks, restatement };
}

/** Everyday words that carry no search meaning on their own. */
const FILLER = new Set(
  (
    "a about after all also am an and any anything are around as at attend be before best but by can " +
    "campus choices could do does events event find for from get give go good great have help hello hey hi how " +
    "i im in interested interesting into is it its just kind kinds know like looking look lot lots " +
    "maybe me mimi more my near need new next of on one options or other our out " +
    "please plan planning recommend really show so some something student students suggest " +
    "thanks thank that the them there these they things thing this those to today tomorrow too " +
    "type types up us want we week what when where which who will with would you your " +
    // Words the interpreter uses for days, times, dates, food, cost and access.
    "monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs fri sat sun " +
    "weekday weekdays weekend weekends morning mornings afternoon afternoons evening evenings night nights " +
    "tonight noon midnight pm early late only not no without except but busy available cant can't " +
    "november nov october oct december dec january jan " +
    "free food coffee snacks snack meal meals pizza drinks refreshments admission cost paid rsvp drop " +
    "nearby close walking distance reset start over any time day days limit"
  ).split(" "),
);

/**
 * Words in a request the simulated planner could not use, for an honest reply
 * ("I couldn’t match ‘edtech’…"). Only meaningful when the request produced no
 * topic or other filter: then every remaining content word went unmatched.
 */
export function unmatchedWords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const out: string[] = [];
  for (const w of words)
    if (w.length > 1 && !FILLER.has(w) && !out.includes(w) && out.length < 4) out.push(w);
  return out;
}
