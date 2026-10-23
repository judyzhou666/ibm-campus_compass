import {
  activeTopics,
  wirePreferences,
  practicalIssue,
} from "./preferences.ts";
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
  const practical = practicalIssue(e, state);
  if (practical) return practical;
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
  const prefs = wirePreferences(state);
  const active = activeTopics(state);
  const topics = constraints.topics?.length ? constraints.topics : active;
  let candidates = EVENTS.filter(
    (e) =>
      !state.plan.includes(e.id) &&
      !issue(e, state) &&
      (!constraints.days || constraints.days.includes(e.day)) &&
      (constraints.after == null || e.start >= constraints.after) &&
      (constraints.before == null || e.end <= constraints.before) &&
      (!constraints.food || e.food === constraints.food) &&
      (!constraints.free || e.cost === 0) &&
      !constraints.excluded?.includes(e.topic) &&
      (!constraints.explore || !active.includes(e.topic)) &&
      !prefs.dismissed.includes(e.id),
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
  const preferenceScore = (e: CampusEvent) =>
    Number(prefs.learning_topics.includes(e.topic)) * 6 +
    Number(prefs.goal_topics.includes(e.topic)) * 3 +
    Number(prefs.primary_topics.includes(e.topic)) * 2 +
    Number(
      (prefs.participation as readonly string[]).includes(
        e.participation || "unknown",
      ),
    ) *
      2;
  const selected: CampusEvent[] = [];
  while (
    candidates.length &&
    selected.length <
      (constraints.limit || (state.preferences ? prefs.count : limit))
  ) {
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
          Number(e.cost === 0) +
          preferenceScore(e)
        : Number(e.cost === 0);
    feasible.sort(
      (a, b) =>
        score(b) - score(a) ||
        a.day - b.day ||
        a.start - b.start ||
        a.id.localeCompare(b.id),
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
    `No conflict with the commitments you entered${state.buffer ? " with a 15-minute travel buffer" : ""}`,
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
