import fixtures from "./fixtures/preference-parity.json";
import { fresh } from "../frontend/src/state.ts";
import { defaultPreferences } from "../frontend/src/preferences.ts";
import type { Schedule, Constraints } from "../frontend/src/types.ts";

export const optimizationCases: {
  name: string;
  state: Schedule;
  constraints: Constraints;
  limit: number;
}[] = fixtures.map((fixture) => ({
  name: fixture.name,
  state: {
    ...fresh(),
    interests: fixture.interests || [],
    preferred_time: fixture.preferred_time || "any",
    cancelled: fixture.cancelled || [],
    preferences: fixture.legacy
      ? undefined
      : ({
          ...defaultPreferences(),
          ...fixture.preferences,
        } as Schedule["preferences"]),
  },
  constraints: (fixture.constraints || {}) as Constraints,
  limit: 3,
}));
for (const mode of [undefined, "plan-building", "discovery"] as const) {
  optimizationCases.push({
    name: `overlap window ${mode || "legacy"}`,
    state: fresh(),
    constraints: { mode, days: [1], after: 900, before: 1020, limit: 5 },
    limit: 3,
  });
}
optimizationCases.push(
  {
    name: "chosen event and ordered real conflicts",
    state: {
      ...fresh(),
      plan: ["e1", "e20"],
      blocks: [
        {
          id: "class",
          title: "First conflicting commitment",
          day: 2,
          start: 1000,
          end: 1200,
        },
      ],
      preferences: { ...defaultPreferences(), count: 5 },
    },
    constraints: {},
    limit: 3,
  },
  {
    name: "legacy caller limit and free-only baseline",
    state: { ...fresh(), preferences: undefined },
    constraints: {},
    limit: 5,
  },
  {
    name: "cancelled chosen event and zero buffer",
    state: { ...fresh(), plan: ["e1"], cancelled: ["e1"], buffer: 0 },
    constraints: { mode: "discovery", limit: 5 },
    limit: 3,
  },
  {
    name: "raw partial and malformed preferences",
    state: {
      ...fresh(),
      preferences: {
        goals: ["constructor", "career"],
        primary_goal: "career",
        use_goals: true,
        count: "5",
        learning_topics: [{ topic: "Not supported", source: "Added by you" }],
        windows: [{ day: 8, start: 50, end: 25 }],
      } as unknown as Schedule["preferences"],
    },
    constraints: { excluded: ["Social"], food: "Coffee & snacks" },
    limit: 3,
  },
  {
    name: "saved count five and paid availability window",
    state: {
      ...fresh(),
      preferences: {
        ...defaultPreferences(),
        count: 5,
        windows: [{ day: 2, start: 1020, end: 1200 }],
      },
    },
    constraints: { topics: ["Arts & culture"] },
    limit: 3,
  },
);
