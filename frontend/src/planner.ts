import type { CampusEvent, Schedule, Constraints, TimeSlot } from "./types.ts";
import { EVENTS } from "./data.ts";
import { effectiveEvents } from "./updates.ts";
import { busyBlocks } from "./personalEvents.ts";
export const overlap = (a: TimeSlot, b: TimeSlot, buffer = 0) =>
  a.day === b.day && a.start < b.end + buffer && b.start < a.end + buffer;
/**
 * Check whether an event has a scheduling issue.
 * Pass `eventsOverride` to use effective (time-moved) event times instead of the catalog.
 * When the state carries applied synthetic updates, they are always honoured:
 * a "full" update blocks the event and a "time_moved" update changes its times.
 */
export function issue(
  event: CampusEvent,
  state: Schedule,
  eventsOverride?: CampusEvent[],
) {
  const applied = state.appliedUpdateIds ?? [];
  const planEvents =
    eventsOverride ?? (applied.length ? effectiveEvents(applied) : EVENTS);
  const e =
    applied.length || eventsOverride
      ? (planEvents.find((x) => x.id === event.id) ?? event)
      : event;
  if (e.day > 4 || e.day < 0 || e.start >= e.end || e.end > 1440)
    return "Invalid event metadata; team review required";
  if (!["RSVP required", "Drop-in welcome"].includes(e.rsvp))
    return "RSVP requirements unknown; team review required";
  if (state.cancelled.includes(e.id)) return "Cancelled in demo";
  if (e.access === "full") return "Event is full";
  if (e.access === "members") return "Membership not verified";
  if (!["open", "members", "full"].includes(e.access))
    return "Eligibility not confirmed";
  const conflict = conflictWith(e, state, planEvents);
  return conflict
    ? `Conflicts with ${conflict.title}${state.buffer ? " (including travel time)" : ""}`
    : null;
}
/**
 * The class, personal calendar item or planned event that `e` overlaps
 * (with the travel buffer), if any. Pass the event with its effective times.
 */
export function conflictWith(
  e: CampusEvent,
  state: Schedule,
  planEvents: CampusEvent[] = EVENTS,
) {
  return [
    ...busyBlocks(state),
    ...planEvents.filter(
      (x) =>
        state.plan.includes(x.id) &&
        x.id !== e.id &&
        !state.cancelled.includes(x.id),
    ),
  ].find((x) => overlap(e, x, state.buffer));
}
export function recommend(
  state: Schedule,
  constraints: Constraints = {},
  limit = 3,
  contextual = true,
  eventsOverride?: CampusEvent[],
) {
  const topics = constraints.topics?.length
    ? constraints.topics
    : state.interests;
  const eventList = eventsOverride ?? EVENTS;
  let candidates = eventList.filter(
    (e) =>
      !state.plan.includes(e.id) &&
      !issue(e, state, eventsOverride) &&
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
  // Weights: topic 30 > novelty 12 > relevance (up to 8) > preferred time 2 > free 1.
  // Without focus terms this ranks exactly as the earlier 10/4/2/1 weights did.
  const focus = constraints.focus ?? [];
  const base = (e: CampusEvent) =>
    Number(topics.includes(e.topic)) * 30 +
    relevance(e, focus) * 4 +
    2 * Number(preferred(e, state)) +
    Number(e.cost === 0);
  candidates.sort(
    (a, b) => base(b) - base(a) || a.day - b.day || a.start - b.start,
  );
  const selected: CampusEvent[] = [];
  while (candidates.length && selected.length < (constraints.limit || limit)) {
    const feasible = candidates.filter(
      (e) => !selected.some((x) => overlap(e, x, state.buffer)),
    );
    const score = (e: CampusEvent) =>
      contextual
        ? base(e) +
          Number(
            topics.includes(e.topic) &&
              !selected.some((x) => x.topic === e.topic),
          ) *
            12
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
/** Lowercases a topic for use mid-sentence but keeps acronyms such as "AI". */
const midSentence = (topic: string) =>
  topic
    .split(" ")
    .map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase()))
    .join(" ");
export function reasons(e: CampusEvent, state: Schedule, c: Constraints = {}) {
  return [
    (c.topics || state.interests).includes(e.topic)
      ? `Matches your interest in ${midSentence(e.topic)}`
      : `An opportunity to explore ${midSentence(e.topic)}`,
    `Fits your schedule${state.buffer ? " with a 15-minute travel buffer" : ""}`,
    e.cost === 0 ? "Free admission" : `$${e.cost} admission`,
    e.food === "Unknown"
      ? "Food availability is unconfirmed"
      : e.food === "None"
        ? "No food provided"
        : e.food,
  ];
}

/** How many focus terms (at most 2) appear as whole words in the title or description. */
export function relevance(e: CampusEvent, focus: string[]) {
  const text = `${e.title} ${e.description}`.toLowerCase();
  let n = 0;
  for (const term of focus)
    if (new RegExp(`\\b${term.replace(/ /g, "\\s+")}\\b`).test(text)) n++;
  return Math.min(n, 2);
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
