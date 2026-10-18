import type { CampusEvent, Schedule, Constraints, TimeSlot } from "./types.ts";
import { EVENTS } from "./data.ts";
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
