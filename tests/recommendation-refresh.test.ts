import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  createStore,
  restore,
  STORAGE_KEY,
} from "../frontend/src/state.ts";
import { createConversation } from "../frontend/src/conversation.ts";
import {
  defaultPreferences,
  preferenceSettingsKey,
} from "../frontend/src/preferences.ts";
import { readResolvedConstraints } from "../frontend/src/recommendationReasons.ts";
import type { Constraints } from "../frontend/src/types.ts";

const offline: typeof fetch = async () => {
  throw Error("offline");
};
test("refresh uses the selected message's original career/day/time with current preferences, independently of other searches", async () => {
  const requests: Record<string, any>[] = [];
  const fetcher: typeof fetch = async (_path, options) => {
    requests.push(JSON.parse(String(options?.body)));
    throw Error("offline");
  };
  const demo = createStore(fresh()),
    c = createConversation(demo, () => {}, fetcher);
  await c.chat("career events on Tuesday after 3 PM");
  const first = structuredClone(demo.read().messages.at(-1)!);
  assert.deepEqual(first.resolvedConstraints, {
    mode: "discovery",
    topics: ["Career"],
    days: [1],
    after: 900,
  });
  await c.chat("social events on Thursday before 5 PM", {});
  const second = structuredClone(demo.read().messages.at(-1)!);
  const history = structuredClone(demo.read().messages);
  demo.update((s) => ({
    ...s,
    interests: ["Wellbeing"],
    preferences: { ...defaultPreferences(), count: 1 },
    constraints: {},
    draft: [],
  }));
  c.reset();
  await c.refresh("plan-building", first);
  assert.deepEqual(requests.at(-1)!.previous, {
    ...first.resolvedConstraints,
    mode: "plan-building",
  });
  assert.deepEqual(requests.at(-1)!.state.interests, ["Wellbeing"]);
  assert.equal(requests.at(-1)!.state.preferences.count, 1);
  assert.deepEqual(demo.read().messages.slice(0, history.length), history);
  assert.deepEqual(demo.read().messages.at(-1)!.resolvedConstraints, {
    ...first.resolvedConstraints,
    mode: "plan-building",
  });
  assert.equal(
    demo.read().messages.at(-1)!.settingsKey,
    preferenceSettingsKey(demo.read()),
  );
  await c.refresh(undefined, second);
  assert.deepEqual(
    demo.read().messages.at(-1)!.resolvedConstraints,
    second.resolvedConstraints,
  );
  assert.deepEqual(demo.read().messages.slice(0, history.length), history);
  assert.deepEqual(demo.read().plan, []);
  assert.deepEqual(demo.read().rsvps, []);
});
test("refresh preserves every supported filter and clones stored constraints", async () => {
  const filters: Constraints = {
    mode: "discovery",
    topics: ["Career"],
    excluded: ["Social"],
    days: [1],
    after: 900,
    before: 1200,
    food: "Free meal",
    free: true,
    limit: 3,
    explore: true,
  };
  const demo = createStore(fresh()),
    c = createConversation(demo, () => {}, offline);
  await c.chat("Find events", filters);
  const message = structuredClone(demo.read().messages.at(-1)!);
  assert.deepEqual(message.resolvedConstraints, filters);
  demo.update((s) => ({
    ...s,
    constraints: { topics: ["Wellbeing"], days: [4] },
  }));
  await c.refresh(undefined, message);
  assert.deepEqual(demo.read().messages.at(-1)!.resolvedConstraints, filters);
  demo.read().constraints.days!.push(4);
  assert.deepEqual(message.resolvedConstraints!.days, [1]);
  assert.deepEqual(demo.read().messages.at(-1)!.resolvedConstraints!.days, [1]);
});
test("legacy or invalid message snapshots require restatement without a planner request", async () => {
  let calls = 0;
  const demo = createStore({
    ...fresh(),
    constraints: { topics: ["Social"], days: [4] },
  });
  const c = createConversation(
    demo,
    () => {},
    async () => {
      calls++;
      throw Error("unexpected");
    },
  );
  for (const resolvedConstraints of [
    undefined,
    { days: [99] } as Constraints,
  ]) {
    await c.refresh("discovery", {
      role: "assistant",
      text: "Legacy suggestion",
      eventIds: ["e1"],
      resolvedConstraints,
    });
    assert.match(
      demo.read().messages.at(-1)!.text,
      /restate the complete search/,
    );
  }
  assert.equal(calls, 0);
  assert.deepEqual(demo.read().constraints, { topics: ["Social"], days: [4] });
});
test("validated message constraints survive reload independently of global chat filters", () => {
  const filters: Constraints = {
    topics: ["Career"],
    days: [1],
    after: 900,
    free: true,
  };
  const state = {
    ...fresh(),
    messages: [
      {
        role: "assistant",
        text: "Saved",
        eventIds: ["e1"],
        resolvedConstraints: filters,
      },
    ],
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) =>
        key === STORAGE_KEY ? JSON.stringify(state) : null,
    },
  });
  try {
    const result = restore();
    assert.deepEqual(result.constraints, {});
    assert.deepEqual(result.messages[0].resolvedConstraints, filters);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
  assert.equal(
    readResolvedConstraints({ topics: ["Not supported"] }),
    undefined,
  );
});
