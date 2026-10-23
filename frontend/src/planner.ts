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
export const RANKING_WEIGHTS = {
  topic: 10,
  diversity: 4,
  learning: 6,
  goal: 3,
  primary: 2,
  participation: 2,
  preferred_time: 2,
  free: 1,
} as const;
export type MatchKind = keyof typeof RANKING_WEIGHTS;
export interface RecommendationMatch {
  kind: MatchKind;
  points: number;
  explanation: string;
}
/** Describes ranking only; callers must still apply eligibility and hard filters. */
export function rankingDetails(
  e: CampusEvent,
  state: Schedule,
  constraints: Constraints = {},
  selected: readonly CampusEvent[] = [],
) {
  const p = wirePreferences(state);
  const current = !!constraints.topics?.length;
  const topics = current ? constraints.topics! : activeTopics(state);
  const topicMatch = topics.includes(e.topic);
  const matches: RecommendationMatch[] = [];
  const add = (kind: MatchKind, matchesInput: boolean, explanation: string) => {
    if (matchesInput)
      matches.push({ kind, points: RANKING_WEIGHTS[kind], explanation });
  };
  add(
    "topic",
    topicMatch,
    current
      ? `Matches this search topic: ${e.topic}`
      : `Matches saved interests or enabled topics: ${e.topic}`,
  );
  add(
    "diversity",
    topicMatch && !selected.some((x) => x.topic === e.topic),
    "Adds a requested or saved topic not yet represented in these suggestions",
  );
  add(
    "learning",
    p.learning_topics.includes(e.topic),
    `Connects to your enabled confirmed ${e.topic} topic`,
  );
  add(
    "goal",
    p.goal_topics.includes(e.topic),
    `Connects to an enabled structured goal mapped to ${e.topic}`,
  );
  add(
    "primary",
    p.primary_topics.includes(e.topic),
    `Connects to your enabled primary-goal topic: ${e.topic}`,
  );
  add(
    "participation",
    !!e.participation &&
      e.participation !== "unknown" &&
      p.participation.some((choice) => choice === e.participation),
    `Matches your chosen fictional participation format: ${e.participation}`,
  );
  add(
    "preferred_time",
    preferred(e, state),
    `Matches your preferred ${state.preferred_time} time`,
  );
  add("free", e.cost === 0, "Free admission");
  return {
    score: matches.reduce((sum, match) => sum + match.points, 0),
    matches,
  };
}

export function recommend(
  state: Schedule,
  constraints: Constraints = {},
  limit = 3,
  contextual = true,
) {
  const prefs = wirePreferences(state);
  const active = activeTopics(state);
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
  const selected: CampusEvent[] = [];
  while (
    candidates.length &&
    selected.length <
      (constraints.limit || (state.preferences ? prefs.count : limit))
  ) {
    const feasible = candidates.filter(
      (e) =>
        constraints.mode === "discovery" ||
        !selected.some((x) => overlap(e, x, state.buffer)),
    );
    const score = (e: CampusEvent) =>
      contextual
        ? rankingDetails(e, state, constraints, selected).score
        : Number(e.cost === 0);
    feasible.sort(
      (a, b) =>
        score(b) - score(a) ||
        a.day - b.day ||
        a.start - b.start ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    if (!feasible.length) break;
    selected.push(feasible[0]);
    candidates = candidates.filter((e) => e.id !== feasible[0].id);
  }
  return selected;
}
export function recommendWithReasons(
  state: Schedule,
  constraints: Constraints = {},
) {
  const selected = recommend(state, constraints);
  return selected.map((event, index) => ({
    event,
    ...rankingDetails(event, state, constraints, selected.slice(0, index)),
  }));
}

export function reasons(e: CampusEvent, state: Schedule, c: Constraints = {}) {
  return [
    ...rankingDetails(e, state, c)
      .matches.filter((match) => !["diversity", "free"].includes(match.kind))
      .map((match) => match.explanation),
    issue(e, state) ||
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

export function overlappingAlternatives(
  event: CampusEvent,
  ids: readonly string[],
  state: Schedule,
) {
  return EVENTS.filter(
    (other) =>
      other.id !== event.id &&
      ids.includes(other.id) &&
      overlap(event, other, state.buffer),
  ).map((other) => other.id);
}
