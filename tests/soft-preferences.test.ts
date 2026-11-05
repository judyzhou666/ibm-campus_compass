import { test } from "node:test";
import assert from "node:assert/strict";
import { EVENTS } from "../frontend/src/data.ts";
import { fresh, createStore } from "../frontend/src/state.ts";
import { defaultPreferences } from "../frontend/src/preferences.ts";
import { recommend, issue, rankingDetails } from "../frontend/src/planner.ts";
import { createEnrollment } from "../frontend/src/enrollment.ts";
import { validateEvent } from "../frontend/src/api.ts";
const offline: typeof fetch = async () => {
  throw Error("offline");
};
const event = (id: string) => EVENTS.find((e) => e.id === id)!;

test("free-only filters recommendations but permits an explicit paid addition and keeps it valid", async () => {
  const state = {
    ...fresh(),
    blocks: [],
    preferences: { ...defaultPreferences(), free_only: true },
  };
  const demo = createStore(state),
    enrollment = createEnrollment(demo, offline);
  assert.ok(event("e29").cost > 0);
  assert.equal(issue(event("e29"), state), null);
  assert.ok(
    !recommend(state, { topics: ["Arts & culture"] }).some(
      (e) => e.id === "e29",
    ),
  );
  assert.equal((await validateEvent("e29", state, offline)).issue, null);
  assert.equal((await enrollment.choose("e29")).kind, "added");
  assert.ok(demo.read().plan.includes("e29"));
  assert.equal(issue(event("e29"), demo.read()), null);
  demo.update((s) => ({
    ...s,
    preferences: { ...s.preferences!, free_only: false },
  }));
  demo.update((s) => ({
    ...s,
    preferences: { ...s.preferences!, free_only: true },
  }));
  assert.equal(issue(event("e29"), demo.read()), null);
});
test("preferred windows filter recommendations without blocking an explicit outside-window RSVP", async () => {
  const state = {
    ...fresh(),
    blocks: [],
    preferences: {
      ...defaultPreferences(),
      windows: [{ day: 0, start: 480, end: 540 }],
    },
  };
  const demo = createStore(state),
    enrollment = createEnrollment(demo, offline);
  assert.equal(issue(event("e1"), state), null);
  assert.ok(!recommend(state).some((e) => e.id === "e1"));
  assert.equal((await enrollment.choose("e1")).kind, "rsvp");
  assert.deepEqual(demo.read().plan, []);
  assert.equal(
    (await enrollment.confirm({ display_name: "Demo", attending: true })).kind,
    "added",
  );
  assert.deepEqual(demo.read().rsvps, ["e1"]);
  assert.equal(issue(event("e1"), demo.read()), null);
});
test("real conflicts and eligibility still prevent explicit additions", async () => {
  const state = {
    ...fresh(),
    preferences: { ...defaultPreferences(), free_only: true },
    blocks: [
      {
        id: "class",
        title: "Actual class",
        day: 2,
        start: event("e29").start,
        end: event("e29").end,
      },
    ],
  };
  const demo = createStore(state),
    enrollment = createEnrollment(demo, offline);
  assert.match(issue(event("e29"), state)!, /Conflicts/);
  assert.equal((await enrollment.choose("e29")).kind, "rejected");
  for (const e of EVENTS.filter((e) =>
    ["members", "full"].includes(e.access),
  )) {
    assert.ok(issue(e, state));
    assert.equal((await enrollment.choose(e.id)).kind, "rejected");
  }
  const planned = {
    ...fresh(),
    blocks: [],
    plan: ["e1"],
    preferences: {
      ...defaultPreferences(),
      windows: [{ day: 0, start: 480, end: 540 }],
    },
  };
  assert.match(issue(event("e17"), planned)!, /Conflicts/);
  assert.ok(issue(event("e1"), { ...planned, plan: [], cancelled: ["e1"] }));
  assert.deepEqual(demo.read().plan, []);
});
test("recommendation filters and deterministic ranking remain intact", () => {
  const state = {
    ...fresh(),
    blocks: [],
    preferences: {
      ...defaultPreferences(),
      free_only: false,
      windows: [{ day: 2, start: 1020, end: 1200 }],
    },
  };
  assert.ok(
    recommend(state, { topics: ["Arts & culture"] }).some(
      (e) => e.id === "e29",
    ),
  );
  const score = rankingDetails(event("e29"), state);
  state.preferences.free_only = true;
  assert.deepEqual(rankingDetails(event("e29"), state), score);
  assert.ok(
    recommend(state, { mode: "discovery", limit: 5 }).every(
      (e) => e.cost === 0 && e.day === 2 && e.start >= 1020 && e.end <= 1200,
    ),
  );
  assert.ok(
    rankingDetails(event("e1"), state).matches.some(
      (m) => m.kind === "free" && m.points === 1,
    ),
  );
});

test("recommendation response validation still filters saved preferences without blocking manual choices", async () => {
  const { createConversation } =
    await import("../frontend/src/conversation.ts");
  const state = {
    ...fresh(),
    blocks: [],
    preferences: { ...defaultPreferences(), free_only: true },
  };
  const demo = createStore(state);
  const conversation = createConversation(
    demo,
    () => {},
    async () =>
      Response.json({
        mode: "simulated",
        understood: true,
        constraints: { topics: ["Arts & culture"] },
        event_ids: ["e29"],
      }),
  );
  await conversation.chat("arts events");
  assert.deepEqual(demo.read().draft, []);
  assert.equal(issue(event("e29"), demo.read()), null);
});
