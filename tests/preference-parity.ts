import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fixtures from "./fixtures/preference-parity.json";
import { fresh } from "../frontend/src/state.ts";
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
  ) {
    const expected = recommendWithReasons(state, constraints).map(
      ({ event, score, matches }) => ({ event_id: event.id, score, matches }),
    );
    const response = await fetch(base + "/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Find events",
        previous: constraints,
        state: schedulePayload(state),
      }),
    });
    assert.equal(response.status, 200, name);
    const actual = await response.json();
    assert.deepEqual(actual.matchReasons, expected, name);
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
