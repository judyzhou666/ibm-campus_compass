/**
 * Home page data: announcements, category quick entries and the
 * "Recommendations for you" list.
 *
 * Everything here is deterministic and works on the same fictional catalog as
 * Explore Events, so a recommended card is exactly the card Explore shows.
 * No AI is involved; the ranking is a simple, explainable score.
 */
import { EVENTS } from "./data.ts";
import { issue } from "./planner.ts";
import { fresh } from "./state.ts";
import type { AppNotification } from "./notifications.ts";
import type { CampusEvent, DemoState } from "./types.ts";

export interface HomeCategory {
  label: string;
  /** The Explore Events filter chip this entry opens. */
  filter: string;
  icon: string;
  /** CSS modifier for the category colour. */
  tone: string;
}

/**
 * Quick entries for the kinds of opportunity the proposal names: learning,
 * career and social events, hands-on workshops, wellbeing, arts and culture,
 * and simply coming for a meal. Each one matches an Explore Events filter.
 */
export const HOME_CATEGORIES: HomeCategory[] = [
  { label: "Academic", filter: "Academic", icon: "academic", tone: "academic" },
  { label: "Career", filter: "Career", icon: "briefcase", tone: "career" },
  { label: "Social", filter: "Social", icon: "users", tone: "social" },
  { label: "Workshops", filter: "Workshops", icon: "pencil", tone: "academic" },
  { label: "Wellbeing", filter: "Wellbeing", icon: "heart", tone: "wellbeing" },
  { label: "Arts", filter: "Arts", icon: "palette", tone: "arts" },
  { label: "Free food", filter: "Free Food", icon: "food", tone: "social" },
];

/**
 * Turns a stream of trackpad wheel deltas into at most one slide step per
 * swipe. A swipe (including its momentum tail) ends after `idleMs` without
 * wheel events. Returns 1 (next), -1 (previous) or 0 (no change).
 */
export function createWheelSwipe(threshold = 40, idleMs = 250) {
  let total = 0;
  let last = -Infinity;
  let fired = false;
  return (dx: number, dy: number, now: number): -1 | 0 | 1 => {
    if (now - last > idleMs) {
      total = 0;
      fired = false;
    }
    last = now;
    if (fired || Math.abs(dx) <= Math.abs(dy)) return 0;
    total += dx;
    if (Math.abs(total) < threshold) return 0;
    fired = true;
    return total > 0 ? 1 : -1;
  };
}

/** Number of catalog events an Explore filter would show. */
export function categoryCount(filter: string, events = EVENTS) {
  return events.filter((e) =>
    filter === "Free Food" ? e.food === "Free meal" : e.category === filter,
  ).length;
}

/** Notifications that point at a catalog event, newest first. */
export function announcements(list: AppNotification[]) {
  return list.filter(
    (n) => n.eventId && EVENTS.some((e) => e.id === n.eventId),
  );
}

const DEFAULT_INTERESTS = fresh().interests;
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * True once the student has told us something in Profile: interests other
 * than the starting set, goal types, a preferred time, a major or goals.
 */
export function hasPreferences(state: DemoState) {
  return (
    (state.interests.length > 0 &&
      !sameSet(state.interests, DEFAULT_INTERESTS)) ||
    state.goal_types.length > 0 ||
    (!!state.preferred_time && state.preferred_time !== "any") ||
    state.major.trim() !== "" ||
    state.goals.trim() !== ""
  );
}

/** Words of four or more letters from free-text profile fields. */
const keywords = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4);

function inPreferredTime(e: CampusEvent, time: string | undefined) {
  if (time === "morning") return e.end <= 720;
  if (time === "afternoon") return e.start >= 720 && e.end <= 1020;
  if (time === "evening") return e.start >= 1020;
  return false;
}

/** Preference score; higher is a better match. */
export function preferenceScore(e: CampusEvent, state: DemoState) {
  const words = keywords(`${state.major} ${state.goals}`);
  const text =
    `${e.title} ${e.description} ${e.topic} ${e.host_school ?? ""}`.toLowerCase();
  return (
    (state.interests.includes(e.topic) ? 10 : 0) +
    4 * (e.goal_type ?? []).filter((g) => state.goal_types.includes(g)).length +
    (inPreferredTime(e, state.preferred_time) ? 2 : 0) +
    (words.some((w) => text.includes(w)) ? 3 : 0) +
    (e.cost === 0 ? 1 : 0)
  );
}

const byTime = (a: CampusEvent, b: CampusEvent) =>
  a.day - b.day || a.start - b.start;

export interface HomeRecommendations {
  personalized: boolean;
  events: CampusEvent[];
}

/**
 * Events for "Recommendations for you". Only events the student could still
 * add are suggested (not already planned, not full, cancelled or clashing).
 * With preferences: ranked by preference score. Without: a default mix that
 * takes the earliest free-first event from each category in turn.
 */
export function homeRecommendations(
  state: DemoState,
  limit = 8,
  events = EVENTS,
): HomeRecommendations {
  const open = events.filter(
    (e) => !state.plan.includes(e.id) && !issue(e, state),
  );
  if (hasPreferences(state)) {
    const ranked = [...open].sort(
      (a, b) =>
        preferenceScore(b, state) - preferenceScore(a, state) || byTime(a, b),
    );
    return { personalized: true, events: ranked.slice(0, limit) };
  }
  const queues = HOME_CATEGORIES.filter((c) => c.filter !== "Free Food").map(
    (c) =>
      open
        .filter((e) => e.category === c.filter)
        .sort(
          (a, b) => Number(b.cost === 0) - Number(a.cost === 0) || byTime(a, b),
        ),
  );
  const picked: CampusEvent[] = [];
  while (picked.length < limit && queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next && picked.length < limit) picked.push(next);
    }
  }
  return { personalized: false, events: picked };
}

/** One-line explanation of what the recommendations are based on. */
export function recommendationBasis(state: DemoState, personalized: boolean) {
  if (!personalized) return "Popular picks across campus this demo week.";
  const parts: string[] = [];
  if (state.interests.length)
    parts.push(`your interests (${state.interests.join(", ")})`);
  if (state.goal_types.length)
    parts.push(`your goals (${state.goal_types.join(", ")})`);
  if (state.preferred_time && state.preferred_time !== "any")
    parts.push(`${state.preferred_time} times`);
  if (state.major.trim()) parts.push(`your major (${state.major.trim()})`);
  return parts.length
    ? `Based on ${parts.join(", ")}.`
    : "Based on your profile.";
}
