import type { Schedule, Constraints } from "../frontend/src/types.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, createStore } from "../frontend/src/state.ts";
import {
  recommendationPreferenceKey,
  recommendationSettingsKey,
  requestPlan,
} from "../frontend/src/api.ts";
import { discoveryState } from "../frontend/src/discovery.ts";
import { noMatchReason, recommend } from "../frontend/src/planner.ts";
import { interpretRequest } from "../frontend/src/interpretation.ts";
import { createConversation } from "../frontend/src/conversation.ts";
const offline: typeof fetch = async () => {
  throw Error("offline");
};

test("principal schedule intent wins over its exploratory purpose", () => {
  assert.equal(
    interpretRequest("Build my weekly plan to explore career options")
      .constraints.mode,
    "plan-building",
  );
  assert.equal(
    interpretRequest("Explore social events to make friends this week")
      .constraints.mode,
    "discovery",
  );
});

test("schedule changes invalidate requests without resetting clarification/skips; preferences still reset", async () => {
  const store = createStore(fresh()),
    c = createConversation(store, () => {}, offline);
  const initial = recommendationPreferenceKey(store.read());
  const schedule = recommendationSettingsKey(store.read());
  await c.chat("Explore beyond my interests after 3");
  for (const change of [
    { plan: ["e20"] },
    { plan: [] },
    { cancelled: ["e20"] },
    {
      blocks: [
        { id: "b", title: "Actual commitment", day: 0, start: 600, end: 660 },
      ],
    },
  ]) {
    store.update((s) => ({ ...s, ...change }));
    assert.equal(recommendationPreferenceKey(store.read()), initial);
  }
  assert.notEqual(recommendationSettingsKey(store.read()), schedule);
  await c.chat("PM");
  assert.equal(store.read().constraints.after, 900);
  assert.equal(store.read().constraints.explore, true);
  assert.equal(store.read().constraints.mode, "discovery");
  await c.chat("AI events on Tuesday after 1 PM", {});
  await c.another("e1");
  store.update((s) => ({ ...s, plan: ["e20"], cancelled: [] }));
  await c.chat("after 2 PM");
  assert.ok(!store.read().draft.includes("e1"));
  store.update((s) => ({ ...s, interests: ["Career"] }));
  assert.notEqual(recommendationPreferenceKey(store.read()), initial);
  c.reset();
  await c.chat("AI events on Tuesday after 1 PM");
  assert.ok(store.read().draft.includes("e1"));
});

test("view filters are separate from real dismissals and have actionable offline diagnostics", async () => {
  const state = fresh();
  const view = discoveryState(state, [], "All", "no such fictional event");
  assert.deepEqual(view.preferences!.dismissed, []);
  assert.equal(recommend(view).length, 0);
  const result = await requestPlan("Find events", {}, view, offline);
  assert.match(result.notice, /category\/search filters/);
  assert.match(result.notice, /Change the category or search query/);
  assert.doesNotMatch(result.notice, /Restore hidden events/);
  assert.deepEqual(state.preferences!.dismissed, []);
});

test("offline empty results explain dismissals, exploration and impossible hard filters", async () => {
  const state = fresh();
  for (const [snapshot, constraints, pattern] of [
    [
      discoveryState(state, ["e1"]),
      { topics: ["AI & education"], days: [1], after: 900, before: 990 },
      /dismissals/,
    ],
    [
      {
        ...state,
        interests: [
          "AI & education",
          "Career",
          "Social",
          "Arts & culture",
          "Wellbeing",
        ],
        preferences: undefined,
      },
      { explore: true },
      /beyond-interest exploration/,
    ],
    [state, { after: 1439 }, /Nothing matched|No .*events|The matching/],
  ] as [Schedule, Constraints, RegExp][]) {
    const result = await requestPlan(
      "Find events",
      constraints,
      snapshot,
      offline,
      undefined,
      true,
    );
    assert.deepEqual(result.ids, []);
    assert.match(result.notice, pattern);
    assert.ok(result.notice.endsWith(noMatchReason(snapshot, constraints)));
  }
});
