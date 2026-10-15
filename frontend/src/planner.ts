import type { CampusEvent, Schedule, Constraints, TimeSlot } from "./types.ts";
import { EVENTS, TOPICS, DAYS } from "./data.ts";
export const overlap = (a: TimeSlot, b: TimeSlot, buffer = 0) =>
  a.day === b.day && a.start < b.end + buffer && b.start < a.end + buffer;
export function issue(e: CampusEvent, state: Schedule) {
  if (state.cancelled.includes(e.id)) return "Cancelled in demo";
  if (e.access === "full") return "Event is full";
  if (e.access === "members") return "Membership not verified";
  if (e.access === "unknown") return "Eligibility not confirmed";
  const conflict = [
    ...state.blocks,
    ...EVENTS.filter(
      (x) =>
        state.plan.includes(x.id) &&
        x.id !== e.id &&
        !state.cancelled.includes(x.id),
    ),
  ].find((x) => overlap(e, x, state.buffer));
  return conflict
    ? `Conflicts with ${conflict.title}${state.buffer ? " (including travel time)" : ""}`
    : null;
}
const keywords = {
  "AI & education": /\b(ai|education|research|learning|tech|coding|data)\b/i,
  Career: /\b(career|job|industry|alumni|networking|resume|professional)\b/i,
  Social: /\b(social|friend|friends|meet|people|dinner|lunch|community)\b/i,
  "Arts & culture":
    /\b(art|arts|culture|cultural|film|museum|creative|sketch|ceramics)\b/i,
  Wellbeing: /\b(wellbeing|wellness|relax|mindful|movement|quiet|balance)\b/i,
};
export function parseRequest(
  text: string,
  previous: Constraints = {},
): Constraints {
  const q = text.toLowerCase();
  let c = { ...previous };
  if (/\b(reset|start over)\b/.test(q)) c = {};
  if (/\b(reset|start over|any time|any day)\b/.test(q)) {
    delete c.days;
    delete c.after;
    delete c.before;
    delete c.food;
    delete c.free;
    delete c.excluded;
  }
  const topics = Object.entries(keywords)
    .filter(([k, re]) => re.test(q))
    .map(([k]) => k);
  const excluded = Object.entries(keywords)
    .filter(([k, re]) =>
      new RegExp(
        `(?:no|not|avoid|without)\\s+(?:any\\s+)?(?:${re.source.replace(/\\b/g, "")})`,
        "i",
      ).test(q),
    )
    .map(([k]) => k);
  if (topics.length) c.topics = topics.filter((t) => !excluded.includes(t));
  if (excluded.length) c.excluded = excluded;
  const days = DAYS.map((d, i) =>
    new RegExp(`\\b${d.toLowerCase()}(?:day|sday|nesday|rsday)?\\b`).test(q)
      ? i
      : -1,
  ).filter((i) => i >= 0);
  if (days.length) c.days = days;
  if (/\bweekend|saturday|sunday\b/.test(q)) c.days = [5, 6];
  if (/\bweekday/.test(q)) c.days = [0, 1, 2, 3, 4];
  if (/\bafternoon/.test(q)) {
    c.after = 720;
    c.before = 1020;
  }
  if (/\bevening/.test(q)) {
    c.after = 1020;
    delete c.before;
  }
  if (/\bmorning/.test(q)) {
    c.before = 720;
    delete c.after;
  }
  for (const type of ["after", "before"] as const) {
    const m = q.match(
      new RegExp(`\\b${type}\\s+(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?\\b`),
    );
    if (m) {
      let h = +m[1];
      if (m[3] === "pm" && h < 12) h += 12;
      if (m[3] === "am" && h === 12) h = 0;
      if (!m[3] && h < 8) h += 12;
      c[type] = h * 60 + (+m[2] || 0);
    }
  }
  if (/\b(free food|free meal|meal|dinner|lunch)\b/.test(q))
    c.food = "Free meal";
  if (/\b(coffee|tea|snack|refreshment)/.test(q) && !c.food)
    c.food = "Coffee & snacks";
  if (/\b(free|no cost|no-cost|zero budget)\b/.test(q)) c.free = true;
  if (/\b(any food|food doesn.t matter|no food preference)\b/.test(q))
    delete c.food;
  const n = q.match(/\b([1-5])\s+(?:events|choices|options)/);
  if (n) c.limit = +n[1];
  return c;
}
export function recommend(
  state: Schedule,
  constraints: Constraints = {},
  limit = 3,
) {
  const topics = constraints.topics?.length
    ? constraints.topics
    : state.interests;
  let candidates = EVENTS.filter(
    (e) =>
      !state.plan.includes(e.id) &&
      !issue(e, state) &&
      (!constraints.days || constraints.days.includes(e.day)) &&
      (constraints.after == null || e.start >= constraints.after) &&
      (constraints.before == null || e.end <= constraints.before) &&
      (!constraints.food || e.food === constraints.food) &&
      (!constraints.free || e.cost === 0) &&
      !constraints.excluded?.includes(e.topic),
  );
  if (constraints.topics?.length)
    candidates = candidates.filter((e) =>
      constraints.topics?.includes(e.topic),
    );
  candidates.sort(
    (a, b) =>
      Number(topics.includes(b.topic)) * 10 +
        Number(b.cost === 0) -
        (Number(topics.includes(a.topic)) * 10 + Number(a.cost === 0)) ||
      a.day - b.day ||
      a.start - b.start,
  );
  const selected: CampusEvent[] = [];
  for (const e of candidates) {
    if (!selected.some((x) => overlap(e, x, state.buffer))) selected.push(e);
    if (selected.length === (constraints.limit || limit)) break;
  }
  return selected;
}
export function reasons(e: CampusEvent, state: Schedule, c: Constraints = {}) {
  return [
    (c.topics || state.interests).includes(e.topic)
      ? `Matches your interest in ${e.topic.toLowerCase()}`
      : `An opportunity to explore ${e.topic.toLowerCase()}`,
    `Fits your schedule${state.buffer ? " with a 15-minute travel buffer" : ""}`,
    e.cost === 0 ? "Free admission" : `$${e.cost} admission`,
    e.food === "Unknown"
      ? "Food availability is unconfirmed"
      : e.food === "None"
        ? "No food provided"
        : e.food,
  ];
}
