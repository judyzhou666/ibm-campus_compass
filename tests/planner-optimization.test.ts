import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import expected from "./fixtures/planner-before-optimization.json";
import { optimizationCases } from "./planner-optimization-cases.ts";
import {
  recommend,
  recommendWithReasons,
  rankingDetails,
  issue,
} from "../frontend/src/planner.ts";
import { fresh } from "../frontend/src/state.ts";
import {
  defaultPreferences,
  wirePreferences,
} from "../frontend/src/preferences.ts";
import { EVENTS } from "../frontend/src/data.ts";
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
// Captured from bcfb173 before the refactor. Fingerprints lock full ordered
// explanation text, all per-event scores and exact validation diagnostics.
for (const [index, scenario] of optimizationCases.entries()) {
  test(`pre-optimization equivalence: ${scenario.name}`, () => {
    const { name, state, constraints, limit } = scenario;
    const ranked = recommendWithReasons(state, constraints);
    assert.deepEqual(
      {
        name,
        ids: recommend(state, constraints, limit).map((e) => e.id),
        reasonIds: ranked.map((r) => r.event.id),
        scores: ranked.map((r) => r.score),
        explanationsHash: hash(ranked.map((r) => r.matches)),
        baselineIds: recommend(state, constraints, limit, false).map(
          (e) => e.id,
        ),
        allScoresHash: hash(
          EVENTS.map((e) => rankingDetails(e, state, constraints)),
        ),
        validationHash: hash(EVENTS.map((e) => issue(e, state))),
      },
      expected[index],
    );
    for (const r of ranked)
      assert.equal(
        r.event,
        EVENTS.find((e) => e.id === r.event.id),
      );
  });
}

test("each recommendation operation migrates preferences and scans planned IDs once", () => {
  for (const operation of [recommend, recommendWithReasons]) {
    let noteReads = 0,
      planReads = 0;
    const preferences = defaultPreferences();
    Object.defineProperty(preferences, "why", {
      get() {
        noteReads++;
        return "local note";
      },
      configurable: true,
    });
    const state = { ...fresh(), preferences };
    Object.defineProperty(state, "plan", {
      get() {
        planReads++;
        return ["e1"];
      },
      configurable: true,
    });
    wirePreferences(state);
    const singleMigrationReads = noteReads;
    assert.ok(singleMigrationReads > 0);
    noteReads = 0;
    planReads = 0;
    operation(state, { mode: "discovery", limit: 5 });
    assert.equal(noteReads, singleMigrationReads);
    assert.equal(planReads, 1);
  }
});

test("candidate scores are computed once per discovery selection round and reused for reasons", () => {
  const state = { ...fresh(), preferences: defaultPreferences() };
  const eligible = EVENTS.filter((e) => !issue(e, state)).length;
  let costReads = 0;
  const descriptors = EVENTS.map((e) =>
    Object.getOwnPropertyDescriptor(e, "cost")!,
  );
  try {
    EVENTS.forEach((event, index) =>
      Object.defineProperty(event, "cost", {
        configurable: true,
        get() {
          costReads++;
          return descriptors[index].value;
        },
      }),
    );
    const ranked = recommendWithReasons(state, { mode: "discovery", limit: 3 });
    assert.equal(ranked.length, 3);
    // With no saved/request cost or time filters, cost is read only by scoring.
    assert.equal(costReads, eligible + (eligible - 1) + (eligible - 2));
  } finally {
    EVENTS.forEach((event, index) =>
      Object.defineProperty(event, "cost", descriptors[index]),
    );
  }
});

test("separate actions rebuild snapshots even when the same state and preference objects change", () => {
  const state = {
    ...fresh(),
    interests: [] as string[],
    preferences: { ...defaultPreferences(), count: 1 as const },
  };
  const before = recommendWithReasons(state).map((r) => r.event.id);
  state.preferences.use_learning = true;
  state.preferences.learning_topics = [
    { topic: "Career", source: "Added by you" },
  ];
  const after = recommendWithReasons(state).map((r) => r.event.id);
  assert.notDeepEqual(after, before);
  assert.deepEqual(after, ["e20"]);
  state.plan.push("e20");
  assert.ok(!recommend(state).some((e) => e.id === "e20"));
  state.plan = [];
  state.preferences.free_only = true;
  state.preferences.windows = [{ day: 0, start: 480, end: 540 }];
  assert.deepEqual(recommend(state), []);
  state.preferences.windows = [];
  assert.deepEqual(
    recommend(state).map((e) => e.id),
    ["e20"],
  );
});
