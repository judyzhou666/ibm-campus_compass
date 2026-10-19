import type { CampusEvent, Schedule, Constraints, TimeSlot } from "./types.ts";
import { EVENTS } from "./data.ts";
export const overlap = (a: TimeSlot, b: TimeSlot, buffer = 0) =>
  a.day === b.day && a.start < b.end + buffer && b.start < a.end + buffer;
export function issue(e: CampusEvent, state: Schedule) {
  if (e.day > 4 || e.day < 0 || e.start >= e.end || e.end > 1440)
    return "Invalid event metadata; team review required";
  if (!["RSVP required", "Drop-in welcome"].includes(e.rsvp))
    return "RSVP requirements unknown; team review required";
  if (state.cancelled.includes(e.id)) return "Cancelled in demo";
  if (e.access === "full") return "Event is full";
  if (e.access === "members") return "Membership not verified";
  if (!["open", "members", "full"].includes(e.access))
    return "Eligibility not confirmed";
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
  contextual = true,
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
        Number(b.cost === 0) +
        2 * Number(preferred(b, state)) -
        (Number(topics.includes(a.topic)) * 10 +
          Number(a.cost === 0) +
          2 * Number(preferred(a, state))) ||
      a.day - b.day ||
      a.start - b.start,
  );
  const selected: CampusEvent[] = [];
  while (candidates.length && selected.length < (constraints.limit || limit)) {
    const feasible = candidates.filter(
      (e) => !selected.some((x) => overlap(e, x, state.buffer)),
    );
    const score = (e: CampusEvent) =>
      contextual
        ? Number(topics.includes(e.topic)) * 10 +
          Number(
            topics.includes(e.topic) &&
              !selected.some((x) => x.topic === e.topic),
          ) *
            4 +
          2 * Number(preferred(e, state)) +
          Number(e.cost === 0)
        : Number(e.cost === 0);
    feasible.sort(
      (a, b) => score(b) - score(a) || a.day - b.day || a.start - b.start,
    );
    if (!feasible.length) break;
    selected.push(feasible[0]);
    candidates = candidates.filter((e) => e.id !== feasible[0].id);
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

function preferred(e: CampusEvent, state: Schedule) {
  return state.preferred_time === "morning"
    ? e.end <= 720
    : state.preferred_time === "afternoon"
      ? e.start >= 720 && e.end <= 1020
      : state.preferred_time === "evening"
        ? e.start >= 1020
        : false;
}
