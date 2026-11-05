import { test } from "node:test";
import assert from "node:assert/strict";
import { planningKey, recommendationSettingsKey } from "../frontend/src/api.ts";
import {
  preferenceSettingsKey,
  defaultPreferences,
} from "../frontend/src/preferences.ts";
import { fresh, createStore } from "../frontend/src/state.ts";
import { createConversation } from "../frontend/src/conversation.ts";

test("request identity excludes notes, profile text, disabled topics and presentation guidance", () => {
  const initial = { ...fresh(), preferences: defaultPreferences() };
  const next = structuredClone(initial);
  next.name = "Another fictional name";
  next.major = "Local major";
  next.goals = "Local goal";
  next.preferences.why = "private reflection";
  next.preferences.learning_note = "private learning";
  next.preferences.guidance = "steps";
  next.preferences.goals = ["career"];
  next.preferences.use_goals = false;
  next.blocks[0].title = "Renamed commitment";
  assert.equal(planningKey(initial), planningKey(next));
  assert.equal(
    recommendationSettingsKey(initial),
    recommendationSettingsKey(next),
  );
  assert.notEqual(preferenceSettingsKey(initial), preferenceSettingsKey(next)); // Presentation history is separate.
  next.preferences.count = 5;
  assert.notEqual(planningKey(initial), planningKey(next));
});
test("relevant schedule, search and enabled preference changes invalidate requests", () => {
  for (const change of [
    (s: ReturnType<typeof fresh>) => {
      s.buffer = 0;
    },
    (s: ReturnType<typeof fresh>) => {
      s.plan = ["e1"];
    },
    (s: ReturnType<typeof fresh>) => {
      s.constraints = { days: [1] };
    },
    (s: ReturnType<typeof fresh>) => {
      s.preferences = { ...defaultPreferences(), free_only: true };
    },
    (s: ReturnType<typeof fresh>) => {
      s.preferences = {
        ...defaultPreferences(),
        goals: ["career"],
        use_goals: true,
      };
    },
  ]) {
    const state = fresh(),
      key = planningKey(state);
    change(state);
    assert.notEqual(planningKey(state), key);
  }
});
test("inflight chat survives text-only changes but rejects genuinely obsolete planning responses", async () => {
  for (const relevant of [false, true]) {
    const demo = createStore(fresh());
    let finish!: (r: Response) => void;
    const c = createConversation(
      demo,
      () => {},
      async () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = c.chat("career events");
    demo.update((s) => ({
      ...s,
      preferences: {
        ...defaultPreferences(),
        why: "local change",
        guidance: "steps",
        count: relevant ? 1 : 3,
      },
    }));
    finish(
      Response.json({
        mode: "simulated",
        understood: true,
        constraints: { topics: ["Career"] },
        event_ids: ["e20"],
      }),
    );
    await pending;
    assert.deepEqual(demo.read().draft, relevant ? [] : ["e20"]);
  }
});
