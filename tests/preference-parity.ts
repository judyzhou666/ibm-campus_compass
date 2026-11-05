import { createConversation } from "../frontend/src/conversation.ts";
import { EVENTS } from "../frontend/src/data.ts";
import { overlap } from "../frontend/src/planner.ts";
import { interpretRequest } from "../frontend/src/interpretation.ts";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fixtures from "./fixtures/preference-parity.json";
import { fresh, createStore } from "../frontend/src/state.ts";
import {
  defaultPreferences,
  migratePreferences,
  GOAL_TOPICS,
} from "../frontend/src/preferences.ts";
import { recommendWithReasons, issue } from "../frontend/src/planner.ts";
import { requestPlan, schedulePayload } from "../frontend/src/api.ts";
import type { Constraints, DemoState } from "../frontend/src/types.ts";
const server = spawn(
  process.env.CAMPUS_BINARY || "target/debug/campus-compass",
  [],
  {
    env: {
      ...process.env,
      CAMPUS_ADDR: "127.0.0.1:0",
      PLANNER_PROVIDER: "simulated",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
server.stderr.on("data", (data) => process.stderr.write(data));
try {
  const base = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Rust server startup timed out")),
      15000,
    );
    let output = "";
    server.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(Error(`Rust exited ${code}`));
    });
    server.stdout.on("data", (data) => {
      output += data;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
  });
  let compared = 0;
  async function compare(
    name: string,
    state: DemoState,
    constraints: Constraints = {},
    message = "Find events",
  ) {
    const interpreted = interpretRequest(message, constraints);
    const expected = recommendWithReasons(state, interpreted.constraints).map(
      ({ event, score, matches }) => ({ event_id: event.id, score, matches }),
    );
    const response = await fetch(base + "/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        previous: constraints,
        state: schedulePayload(state),
      }),
    });
    assert.equal(response.status, 200, name);
    const actual = await response.json();
    assert.deepEqual(actual.constraints, interpreted.constraints, name);
    assert.deepEqual(actual.match_reasons, expected, name);
    assert.equal(Object.hasOwn(actual, "matchReasons"), false, name);
    assert.deepEqual(
      actual.event_ids,
      expected.map((r) => r.event_id),
      name,
    );
    assert.ok(
      recommendWithReasons(state, constraints).every(
        ({ event }) => !issue(event, state),
      ),
      name,
    );
    compared++;
  }
  for (const fixture of fixtures) {
    const state = {
      ...fresh(),
      interests: fixture.interests || [],
      preferred_time: fixture.preferred_time || "any",
      cancelled: fixture.cancelled || [],
      preferences: fixture.legacy
        ? undefined
        : migratePreferences({
            ...defaultPreferences(),
            ...fixture.preferences,
          }),
    };
    await compare(
      fixture.name,
      state,
      fixture.constraints as Constraints | undefined,
    );
  }
  await compare(
    "explicit weekly planning",
    fresh(),
    { mode: "discovery" },
    "Build a weekly plan",
  );
  await compare(
    "explicit discovery",
    fresh(),
    { mode: "plan-building" },
    "Discover events",
  );
  const overlapWindow: Constraints = {
    days: [1],
    after: 900,
    before: 1020,
    limit: 5,
  };
  await compare("omitted mode is compatible", fresh(), overlapWindow);
  await compare("explicit compatible window", fresh(), {
    ...overlapWindow,
    mode: "plan-building",
  });
  await compare(
    "explicit overlapping exploration",
    fresh(),
    overlapWindow,
    "Explore events",
  );
  const fetcher: typeof fetch = (path, options) =>
    fetch(base + String(path), options);
  for (const [text, expectedMode] of [
    ["events on Tuesday after 3 PM before 5 PM", "plan-building"],
    ["Build a weekly plan on Tuesday after 3 PM before 5 PM", "plan-building"],
    ["Explore events on Tuesday after 3 PM before 5 PM", "discovery"],
  ] as const) {
    const demo = createStore(fresh());
    const conversation = createConversation(demo, () => {}, fetcher);
    await conversation.chat(text);
    const state = demo.read();
    assert.equal(state.messages.at(-1)?.recommendationMode, expectedMode);
    assert.deepEqual(
      state.draft,
      recommendWithReasons(state, {
        ...overlapWindow,
        limit: 3,
        mode: expectedMode,
      }).map((r) => r.event.id),
    );
    const found = state.draft.map((id) => EVENTS.find((e) => e.id === id)!);
    if (expectedMode === "discovery")
      assert.ok(state.draft.includes("e1") && state.draft.includes("e17"));
    else
      for (let i = 0; i < found.length; i++)
        for (const other of found.slice(i + 1))
          assert.equal(overlap(found[i], other, state.buffer), false);
    const message = structuredClone(state.messages.at(-1)!);
    demo.update((s) => ({
      ...s,
      constraints: {},
      preferences: { ...defaultPreferences(), count: 5 },
    }));
    conversation.reset();
    await conversation.refresh(undefined, message);
    assert.equal(demo.read().constraints.mode, expectedMode);
    assert.deepEqual(
      demo.read().messages.at(-1)?.resolvedConstraints,
      message.resolvedConstraints,
    );
  }
  for (const message of [
    "Tuesday afternoon events",
    "Explore beyond my interests",
    "start over",
  ]) {
    await compare(
      "temporary exploration: " + message,
      fresh(),
      { explore: true, mode: "discovery" },
      message,
    );
  }
  for (const message of [
    "explore social events to make friends this week",
    "build my weekly schedule",
    "social events to make friends this week",
  ]) {
    await compare("mode intent: " + message, fresh(), {}, message);
  }
  for (const goal of Object.keys(GOAL_TOPICS)) {
    const state = {
      ...fresh(),
      interests: [],
      preferences: migratePreferences({
        goals: [goal],
        primary_goal: goal,
        use_goals: true,
      }),
    };
    await compare(`goal mapping: ${goal}`, state);
  }
  async function post(path: string, body: unknown) {
    return fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  for (const preferences of [
    { count: 2 },
    { participation: ["unknown"] },
    { learning_topics: Array(6).fill("Career") },
  ]) {
    assert.equal(
      (
        await post("/api/plan", {
          message: "Find events",
          state: { ...schedulePayload(fresh()), preferences },
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await post("/api/enroll", {
        event_id: "e1",
        state: schedulePayload(fresh()),
      })
    ).status,
    422,
  );
  const blocked = {
    ...fresh(),
    blocks: [
      { id: "busy", title: "Local-only label", day: 1, start: 900, end: 990 },
    ],
  };
  assert.equal(
    (
      await post("/api/enroll", {
        event_id: "e1",
        state: schedulePayload(blocked),
        rsvp: { display_name: "Demo", attending: true },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post("/api/enroll", {
        event_id: "e1",
        state: schedulePayload(fresh()),
        rsvp: { display_name: "Demo", attending: true },
      })
    ).status,
    200,
  );
  const online = await requestPlan("Find events", {}, fresh(), (url, init) =>
    fetch(base + url, init),
  );
  assert.equal(online.source, "rust");
  assert.deepEqual(
    online.matchReasons,
    recommendWithReasons(fresh()).map(({ event, score, matches }) => ({
      event_id: event.id,
      score,
      matches,
    })),
  );
  console.log(
    `PASS ${compared} shared-fixture/goal-mapping comparisons: IDs, scores, ordered reason codes/points/explanations; typed Rust client propagation.`,
  );
} finally {
  server.kill();
}
