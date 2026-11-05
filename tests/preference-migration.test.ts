import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultPreferences,
  migratePreferences,
  PREFERENCE_VERSION,
} from "../frontend/src/preferences.ts";

test("absent and unversioned preferences migrate to v1 without inferred consent", () => {
  for (const input of [undefined, null, [], "legacy notes"]) {
    assert.deepEqual(migratePreferences(input), defaultPreferences());
  }
  const migrated = migratePreferences({
    goals: ["career"],
    primary_goal: "career",
    why: "Personal reflection",
    learning_note: "Learning research and design",
  });
  assert.equal(migrated.version, PREFERENCE_VERSION);
  assert.equal(migrated.primary_goal, "career");
  assert.equal(migrated.why, "Personal reflection");
  assert.equal(migrated.learning_note, "Learning research and design");
  assert.deepEqual(migrated.learning_topics, []);
  assert.equal(migrated.use_goals, false);
  assert.equal(migrated.use_learning, false);
});

test("migration rejects inherited enum names and malformed result counts", () => {
  const migrated = migratePreferences({
    goals: ["constructor", "toString", "career"],
    primary_goal: { toString: () => "career" },
    participation: ["__proto__", "constructor", "small-group"],
    guidance: "toString",
  });
  assert.deepEqual(migrated.goals, ["career"]);
  assert.equal(migrated.primary_goal, "");
  assert.deepEqual(migrated.participation, ["small-group"]);
  assert.equal(migrated.guidance, "few");
  for (const count of [true, "1", [5], {}, 0, 2, 9])
    assert.equal(migratePreferences({ count }).count, 3);
  for (const count of [1, 3, 5])
    assert.equal(migratePreferences({ count }).count, count);
});

test("v1 migration is idempotent, retains manual/chat provenance and isolates nested data", () => {
  const input = {
    ...defaultPreferences(),
    goals: ["research"],
    primary_goal: "research",
    learning_topics: [
      { topic: "Career", source: "Added by you", extra: "not a preference" },
      { topic: "Social", source: "Confirmed from a conversation" },
    ],
    windows: [{ day: 1, start: 600, end: 720, extra: "not a window" }],
    use_goals: true,
    use_learning: true,
  };
  const migrated = migratePreferences(input);
  assert.deepEqual(migratePreferences(migrated), migrated);
  assert.deepEqual(migrated.learning_topics, [
    { topic: "Career", source: "Added by you" },
    { topic: "Social", source: "Confirmed from a conversation" },
  ]);
  assert.deepEqual(migrated.windows, [{ day: 1, start: 600, end: 720 }]);
  migrated.learning_topics[0].topic = "Wellbeing";
  migrated.windows[0].start = 610;
  assert.equal(input.learning_topics[0].topic, "Career");
  assert.equal(input.windows[0].start, 600);
  assert.deepEqual(migratePreferences(input).goals, ["research"]);
});
