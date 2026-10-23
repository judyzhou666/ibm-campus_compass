import { TOPICS, EVENTS } from "./data.ts";
import type { DemoState, Schedule, TimeSlot, CampusEvent } from "./types.ts";
export const GOALS = {
  career: "Explore career possibilities",
  practice: "Connect learning to practice",
  research: "Find research opportunities",
  people: "Meet people with shared interests",
  discover: "Discover campus activities",
  wellbeing: "Make room for wellbeing and enjoyment",
  unsure: "Not sure yet",
  other: "Something else",
} as const;
export const GOAL_TOPICS: Record<string, string[]> = {
  career: ["Career"],
  practice: ["AI & education"],
  research: ["AI & education"],
  people: ["Social"],
  discover: [],
  wellbeing: ["Wellbeing"],
  unsure: [],
  other: [],
};
export const PARTICIPATION = {
  independent: "Explore independently",
  "one-to-one": "Connect one-on-one",
  "small-group": "Join a small group",
  open: "Attend larger or open events",
} as const;
export const GUIDANCE = {
  few: "A few suggestions",
  first: "A clear first step",
  steps: "A step-by-step plan",
  information: "More information before deciding",
  none: "No preference",
} as const;
export type Guidance = keyof typeof GUIDANCE;
export interface LearningTopic {
  topic: string;
  source: "Added by you" | "Confirmed from a conversation";
}
export interface Preferences {
  version: 1;
  goals: string[];
  primary_goal: string;
  custom_interest: string;
  why: string;
  learning_note: string;
  next_note: string;
  learning_topics: LearningTopic[];
  participation: string[];
  guidance: Guidance;
  count: 1 | 3 | 5;
  use_goals: boolean;
  use_learning: boolean;
  free_only: boolean;
  windows: TimeSlot[];
  location_note: string;
  format_note: string;
  dismissed: string[];
}
export const defaultPreferences = (): Preferences => ({
  version: 1,
  goals: [],
  primary_goal: "",
  custom_interest: "",
  why: "",
  learning_note: "",
  next_note: "",
  learning_topics: [],
  participation: [],
  guidance: "few",
  count: 3,
  use_goals: false,
  use_learning: false,
  free_only: false,
  windows: [],
  location_note: "",
  format_note: "",
  dismissed: [],
});
export function migratePreferences(value: unknown): Preferences {
  const p = defaultPreferences();
  if (!value || typeof value !== "object") return p;
  const v = value as Record<string, unknown>;
  const text = (key: string, max: number) =>
    typeof v[key] === "string" ? (v[key] as string).slice(0, max) : "";
  p.goals = Array.isArray(v.goals)
    ? [
        ...new Set(
          v.goals.filter(
            (s): s is keyof typeof GOALS => typeof s === "string" && s in GOALS,
          ),
        ),
      ].slice(0, 8)
    : [];
  if (p.goals.includes("unsure")) p.goals = ["unsure"];
  p.primary_goal =
    v.primary_goal !== "unsure" && p.goals.includes(String(v.primary_goal))
      ? String(v.primary_goal)
      : "";
  for (const key of [
    "custom_interest",
    "why",
    "learning_note",
    "next_note",
    "location_note",
    "format_note",
  ] as const)
    p[key] = text(key, key.includes("note") ? 500 : 240);
  p.learning_topics = Array.isArray(v.learning_topics)
    ? v.learning_topics
        .filter(
          (t): t is LearningTopic =>
            !!t &&
            typeof t === "object" &&
            TOPICS.includes((t as LearningTopic).topic) &&
            ["Added by you", "Confirmed from a conversation"].includes(
              (t as LearningTopic).source,
            ),
        )
        .filter((t, i, a) => a.findIndex((x) => x.topic === t.topic) === i)
        .slice(0, 5)
    : [];
  p.participation = Array.isArray(v.participation)
    ? [
        ...new Set(
          v.participation.filter(
            (s): s is string => typeof s === "string" && s in PARTICIPATION,
          ),
        ),
      ]
    : [];
  p.guidance =
    typeof v.guidance === "string" && v.guidance in GUIDANCE
      ? (v.guidance as Guidance)
      : "few";
  p.count = [1, 3, 5].includes(Number(v.count))
    ? (Number(v.count) as 1 | 3 | 5)
    : 3;
  p.use_goals = v.use_goals === true;
  p.use_learning = v.use_learning === true;
  p.free_only = v.free_only === true;
  p.windows = Array.isArray(v.windows)
    ? v.windows
        .filter(
          (w): w is TimeSlot =>
            !!w &&
            typeof w === "object" &&
            Number.isInteger(w.day) &&
            w.day >= 0 &&
            w.day < 5 &&
            Number.isInteger(w.start) &&
            Number.isInteger(w.end) &&
            w.start >= 0 &&
            w.end <= 1440 &&
            w.start < w.end,
        )
        .slice(0, 20)
    : [];
  p.dismissed = Array.isArray(v.dismissed)
    ? v.dismissed
        .filter(
          (id): id is string =>
            typeof id === "string" && EVENTS.some((e) => e.id === id),
        )
        .slice(0, 30)
    : [];
  return p;
}
export function wirePreferences(state: Schedule) {
  const p = migratePreferences(state.preferences);
  return {
    version: 1,
    goal_topics: p.use_goals
      ? [...new Set(p.goals.flatMap((g) => GOAL_TOPICS[g] || []))]
      : [],
    primary_topics: p.use_goals ? GOAL_TOPICS[p.primary_goal] || [] : [],
    learning_topics: p.use_learning
      ? p.learning_topics.map((t) => t.topic)
      : [],
    participation: p.participation,
    guidance: p.guidance,
    count: p.count,
    free_only: p.free_only,
    windows: p.windows.map(({ day, start, end }) => ({ day, start, end })),
    dismissed: p.dismissed,
  };
}
export function activeTopics(state: Schedule) {
  const p = wirePreferences(state);
  return [
    ...new Set([...state.interests, ...p.goal_topics, ...p.learning_topics]),
  ];
}
export function practicalIssue(e: CampusEvent, state: Schedule) {
  const p = wirePreferences(state);
  if (p.free_only && e.cost !== 0)
    return "Outside your saved free-admission requirement";
  if (
    p.windows.length &&
    !p.windows.some(
      (w) => w.day === e.day && e.start >= w.start && e.end <= w.end,
    )
  )
    return "Outside your saved available-only windows";
  return null;
}
export function guidanceText(state: Schedule, e: CampusEvent) {
  switch (wirePreferences(state).guidance) {
    case "first":
      return `First step: view the details for ${e.title}. Adding is optional.`;
    case "steps":
      return "1. Review access and time. 2. Decide whether it suits you. 3. Add only if you choose; confirm demo RSVP if required.";
    case "information":
      return `Before deciding: ${e.rsvp}. Food: ${e.food}. Capacity and external verification may be unknown.`;
    case "none":
      return "Choose what works for you; doing less is fine.";
    default:
      return "A suggestion to consider, not an attendance target.";
  }
}
export function fitReasons(e: CampusEvent, state: Schedule) {
  const p = wirePreferences(state);
  return [
    state.interests.includes(e.topic)
      ? `Interest connection: ${e.topic}`
      : "Explore beyond your saved interests",
    p.learning_topics.includes(e.topic)
      ? `Learning connection: your confirmed ${e.topic} topic`
      : "",
    p.goal_topics.includes(e.topic)
      ? `Connects to an enabled goal in ${e.topic}`
      : "",
    `No conflict with the commitments you entered${state.buffer ? " (including travel buffer)" : ""}`,
    e.participation && e.participation !== "unknown"
      ? `Fictional format: ${PARTICIPATION[e.participation as keyof typeof PARTICIPATION]}`
      : "Participation format: Unknown — confirm before deciding",
  ].filter(Boolean);
}
export function clearPersonalization(s: DemoState): DemoState {
  const old = migratePreferences(s.preferences);
  return {
    ...s,
    interests: [],
    major: "",
    goals: "",
    preferred_time: "any",
    preferences: {
      ...defaultPreferences(),
      free_only: old.free_only,
      windows: old.windows,
    },
    draft: [],
    constraints: {},
  };
}
export function suggestedTopics(text: string) {
  const found: string[] = [];
  if (
    /\b(ai|research|learning|accessibility|educational technology|ux|r|rstudio|data)\b/i.test(
      text,
    )
  )
    found.push("AI & education");
  if (/\b(figma|arts|design|culture)\b/i.test(text))
    found.push("Arts & culture");
  if (/\b(career|resume)\b/i.test(text)) found.push("Career");
  return found;
}
export function proposalTopic(text: string) {
  return /\b(interested in|learning about|explore)\b/i.test(text)
    ? suggestedTopics(text)
    : [];
}
