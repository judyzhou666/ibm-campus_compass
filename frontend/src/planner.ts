import {
  activeTopics,
  wirePreferences,
  practicalIssue,
} from "./preferences.ts";
import type { CampusEvent, Schedule, Constraints, TimeSlot } from "./types.ts";
import { EVENTS } from "./data.ts";
export const overlap = (a: TimeSlot, b: TimeSlot, buffer = 0) =>
  a.day === b.day && a.start < b.end + buffer && b.start < a.end + buffer;
function validationSnapshot(state: Schedule) {
  const plannedIds = new Set(state.plan);
  const cancelled = new Set(state.cancelled);
  return {
    plannedIds,
    cancelled,
    planned: EVENTS.filter(
      (event) => plannedIds.has(event.id) && !cancelled.has(event.id),
    ),
  };
}
function issueWithSnapshot(
  e: CampusEvent,
  state: Schedule,
  snapshot?: ReturnType<typeof validationSnapshot>,
) {
  if (e.day > 4 || e.day < 0 || e.start >= e.end || e.end > 1440)
    return "Invalid event metadata; team review required";
  if (!["RSVP required", "Drop-in welcome"].includes(e.rsvp))
    return "RSVP requirements unknown; team review required";
  if (snapshot ? snapshot.cancelled.has(e.id) : state.cancelled.includes(e.id))
    return "Cancelled in demo";
  if (e.access === "full") return "Event is full";
  if (e.access === "members") return "Membership not verified";
  if (!["open", "members", "full"].includes(e.access))
    return "Eligibility not confirmed";
  const conflict =
    state.blocks.find((x) => overlap(e, x, state.buffer)) ??
    (
      snapshot?.planned ??
      EVENTS.filter(
        (x) => state.plan.includes(x.id) && !state.cancelled.includes(x.id),
      )
    ).find((x) => x.id !== e.id && overlap(e, x, state.buffer));
  return conflict
    ? `Conflicts with ${conflict.title}${state.buffer ? " (including travel time)" : ""}`
    : null;
}
export function issue(e: CampusEvent, state: Schedule) {
  return issueWithSnapshot(e, state);
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
function rankingSnapshot(state: Schedule, constraints: Constraints) {
  const prefs = wirePreferences(state);
  const active = activeTopics(state, prefs);
  const current = !!constraints.topics?.length;
  return {
    prefs,
    active,
    current,
    topics: current ? constraints.topics! : active,
  };
}
/** Describes ranking only; callers must still apply eligibility and hard filters. */
export function rankingDetails(
  e: CampusEvent,
  state: Schedule,
  constraints: Constraints = {},
  selected: readonly CampusEvent[] = [],
) {
  return rankingWithSnapshot(
    e,
    state,
    rankingSnapshot(state, constraints),
    new Set(selected.map((event) => event.topic)),
  );
}
function rankingWithSnapshot(
  e: CampusEvent,
  state: Schedule,
  snapshot: ReturnType<typeof rankingSnapshot>,
  selectedTopics: ReadonlySet<string>,
) {
  const { prefs: p, current, topics } = snapshot;
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
    topicMatch && !selectedTopics.has(e.topic),
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

function selectRecommendations(
  state: Schedule,
  constraints: Constraints = {},
  limit = 3,
  contextual = true,
) {
  // All snapshots are local to this synchronous operation; never cached across actions.
  const ranking = rankingSnapshot(state, constraints);
  const { prefs, active } = ranking;
  const validation = validationSnapshot(state);
  const count = constraints.limit || (state.preferences ? prefs.count : limit);
  let candidates = EVENTS.filter(
    (e) =>
      !validation.plannedIds.has(e.id) &&
      !issueWithSnapshot(e, state, validation) &&
      !practicalIssue(e, state, prefs) &&
      matchesConstraints(e, constraints) &&
      !state.view_excluded?.includes(e.id) &&
      (!constraints.explore || !active.includes(e.topic)) &&
      !prefs.dismissed.includes(e.id),
  );
  const selected: ({ event: CampusEvent } & ReturnType<
    typeof rankingWithSnapshot
  >)[] = [];
  const selectedTopics = new Set<string>();
  while (candidates.length && selected.length < count) {
    const scored = candidates
      .filter(
        (event) =>
          constraints.mode === "discovery" ||
          !selected.some((previous) =>
            overlap(event, previous.event, state.buffer),
          ),
      )
      .map((event) => ({
        event,
        ...(contextual
          ? rankingWithSnapshot(event, state, ranking, selectedTopics)
          : { score: Number(event.cost === 0), matches: [] }),
      }));
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        a.event.day - b.event.day ||
        a.event.start - b.event.start ||
        (a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0),
    );
    if (!scored.length) break;
    const winner = scored[0];
    selected.push(winner);
    selectedTopics.add(winner.event.topic);
    candidates = candidates.filter((event) => event.id !== winner.event.id);
  }
  return selected;
}
export function recommend(
  state: Schedule,
  constraints: Constraints = {},
  limit = 3,
  contextual = true,
) {
  return selectRecommendations(state, constraints, limit, contextual).map(
    (result) => result.event,
  );
}
export function recommendWithReasons(
  state: Schedule,
  constraints: Constraints = {},
) {
  return selectRecommendations(state, constraints);
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

function matchesConstraints(e: CampusEvent, c: Constraints) {
  return (
    (!c.topics?.length || c.topics.includes(e.topic)) &&
    (!c.days || c.days.includes(e.day)) &&
    (c.after == null || e.start >= c.after) &&
    (c.before == null || e.end <= c.before) &&
    (!c.food || e.food === c.food) &&
    (!c.free || e.cost === 0) &&
    !c.excluded?.includes(e.topic)
  );
}

/** Same classification order and copy as Rust; no hard filter is relaxed. */
export function noMatchReason(state: Schedule, c: Constraints = {}) {
  const prefs = wirePreferences(state);
  const active = activeTopics(state, prefs);
  const within = EVENTS.filter(
    (e) => matchesConstraints(e, c) && !practicalIssue(e, state, prefs),
  );
  if (!within.length)
    return "No synthetic catalog records satisfy these topic/day/time/cost/food filters and saved recommendation preferences. State which filter you want to change; none will be relaxed automatically.";
  const snapshot = validationSnapshot(state);
  let conflicts = 0,
    restrictions = 0,
    cancelled = 0,
    missing = 0,
    already = 0,
    dismissed = 0,
    explored = 0,
    view = 0;
  for (const e of within) {
    if (snapshot.plannedIds.has(e.id)) {
      already++;
      continue;
    }
    const problem = issueWithSnapshot(e, state, snapshot);
    if (problem?.startsWith("Conflicts")) conflicts++;
    else if (problem === "Cancelled in demo") cancelled++;
    else if (problem?.includes("RSVP") || problem?.includes("metadata"))
      missing++;
    else if (problem) restrictions++;
    else if (state.view_excluded?.includes(e.id)) view++;
    else if (c.explore && active.includes(e.topic)) explored++;
    else if (prefs.dismissed.includes(e.id)) dismissed++;
  }
  let explanation = `Within your filters: ${conflicts} scheduling conflicts, ${restrictions} full/restricted/unknown-eligibility records, ${cancelled} cancellations, ${missing} incomplete/invalid records, and ${already} already-chosen events. No calendar changes made. Please explicitly choose which filter to change.`;
  if (view)
    explanation += ` ${view} events were hidden by the current category/search filters. Change the category or search query to include them.`;
  if (dismissed)
    explanation += ` ${dismissed} events were hidden by saved or current-search dismissals. Restore hidden events in My Preferences or start a new search to clear session skips.`;
  if (explored)
    explanation += ` ${explored} events were excluded because beyond-interest exploration excludes your active saved topics. Use a normal search or start over to include those topics.`;
  return explanation;
}
