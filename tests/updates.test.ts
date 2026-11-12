import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALL_BATCHES,
  ALL_UPDATES,
  pendingUpdates,
  nextBatch,
  applyNextBatch,
  appliedUpdates,
  updatesInLatestBatch,
  hasConflict,
  effectiveUpdate,
  updateBadge,
  kindLabel,
  relativeTime,
  isUnavailableByUpdate,
  effectiveEvents,
} from "../frontend/src/updates.ts";
import { fresh } from "../frontend/src/state.ts";
import { issue, recommend } from "../frontend/src/planner.ts";
import type { DemoState } from "../frontend/src/types.ts";

test("updates.json loads and has 3 batches with at least 6 updates total", () => {
  assert.equal(ALL_BATCHES.length, 3);
  assert.ok(ALL_UPDATES.length >= 6);
});

test("all updates have required fields", () => {
  for (const u of ALL_UPDATES) {
    assert.ok(
      typeof u.id === "string" && u.id.length > 0,
      `update ${u.id} missing id`,
    );
    assert.ok(typeof u.event_id === "string" && u.event_id.length > 0);
    assert.ok(
      ["cancelled", "full", "time_moved", "room_changed"].includes(u.kind),
    );
    assert.ok(typeof u.timestamp === "string");
    assert.ok(typeof u.details === "string" && u.details.length > 0);
  }
});

test("pendingUpdates returns all when nothing applied", () => {
  const pending = pendingUpdates([]);
  assert.equal(pending.length, ALL_UPDATES.length);
});

test("pendingUpdates filters out applied IDs", () => {
  const firstId = ALL_UPDATES[0].id;
  const pending = pendingUpdates([firstId]);
  assert.equal(pending.length, ALL_UPDATES.length - 1);
  assert.ok(!pending.some((u) => u.id === firstId));
});

test("nextBatch returns first batch when nothing applied", () => {
  const batch = nextBatch([]);
  assert.ok(batch !== null);
  assert.equal(batch!.batch, ALL_BATCHES[0].batch);
});

test("nextBatch returns null when all applied", () => {
  const all = ALL_UPDATES.map((u) => u.id);
  assert.equal(nextBatch(all), null);
});

test("applyNextBatch applies batch 1 updates to fresh state", () => {
  const state = fresh();
  const { nextState, applied, batch } = applyNextBatch(state);
  assert.ok(applied.length > 0, "should apply at least one update");
  assert.equal(batch!.batch, ALL_BATCHES[0].batch);
  // All applied IDs should be in state
  for (const u of applied) {
    assert.ok(nextState.appliedUpdateIds.includes(u.id));
  }
  assert.ok(nextState.lastUpdateCheck !== null);
});

test("applyNextBatch adds cancelled events to state.cancelled", () => {
  const state = fresh();
  const { nextState, applied } = applyNextBatch(state);
  const cancelledUpdates = applied.filter((u) => u.kind === "cancelled");
  for (const u of cancelledUpdates) {
    assert.ok(
      nextState.cancelled.includes(u.event_id),
      `cancelled event ${u.event_id} should be in state.cancelled`,
    );
  }
});

test("applyNextBatch does not add full events to state.cancelled", () => {
  const state = fresh();
  const { nextState, applied } = applyNextBatch(state);
  const fullUpdates = applied.filter((u) => u.kind === "full");
  for (const u of fullUpdates) {
    // Full events are tracked by appliedUpdateIds, not state.cancelled
    assert.ok(
      nextState.appliedUpdateIds.includes(u.id),
      `full update ${u.id} should be in appliedUpdateIds`,
    );
  }
});

test("applyNextBatch advances through all 3 batches", () => {
  let state = fresh();
  for (let i = 0; i < ALL_BATCHES.length; i++) {
    const { nextState, applied, batch } = applyNextBatch(state);
    assert.ok(applied.length > 0, `batch ${i + 1} should apply updates`);
    assert.equal(batch!.batch, ALL_BATCHES[i].batch);
    state = nextState;
  }
  // After all batches, no more pending
  const { applied: noMore } = applyNextBatch(state);
  assert.equal(noMore.length, 0, "no updates should remain after all batches");
});

test("hasConflict detects conflicting notices for e5", () => {
  // u5 = cancelled, u6 = room_changed — both for e5, applied in batch 3
  const allIds = ALL_UPDATES.map((u) => u.id);
  assert.equal(hasConflict("e5", allIds), true);
});

test("hasConflict returns false for non-conflicting event", () => {
  const allIds = ALL_UPDATES.map((u) => u.id);
  // e3 has only one update (u1 = cancelled)
  assert.equal(hasConflict("e3", allIds), false);
});

test("effectiveUpdate returns null for conflicting event", () => {
  const allIds = ALL_UPDATES.map((u) => u.id);
  assert.equal(effectiveUpdate("e5", allIds), null);
});

test("effectiveUpdate returns last update for non-conflicting event", () => {
  // u4 is room_changed for e9
  const result = effectiveUpdate("e9", ["u4"]);
  assert.ok(result !== null);
  assert.equal(result!.id, "u4");
  assert.equal(result!.kind, "room_changed");
});

test("updateBadge returns correct badge", () => {
  const allIds = ALL_UPDATES.map((u) => u.id);
  assert.equal(updateBadge("e5", allIds), "needs-confirmation");
  assert.equal(updateBadge("e3", allIds), "updated");
  assert.equal(updateBadge("e1", allIds), "updated");
  assert.equal(updateBadge("e99-unknown", allIds), null);
  assert.equal(updateBadge("e1", []), null);
});

test("kindLabel returns human-readable strings", () => {
  assert.equal(kindLabel("cancelled"), "Cancelled");
  assert.equal(kindLabel("full"), "Now full");
  assert.equal(kindLabel("time_moved"), "Time changed");
  assert.equal(kindLabel("room_changed"), "Room changed");
});

test("relativeTime formats correctly", () => {
  const now = new Date().toISOString();
  assert.equal(relativeTime(now), "just now");

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  assert.match(relativeTime(tenMinAgo), /10 minutes ago/);

  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  assert.match(relativeTime(twoHoursAgo), /2 hours ago/);

  const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
  assert.match(relativeTime(twoDaysAgo), /2 days ago/);
});

test("isUnavailableByUpdate detects cancelled and full", () => {
  // u1 cancels e3, u2 fulls e6
  assert.equal(isUnavailableByUpdate("e3", ["u1"]), true);
  assert.equal(isUnavailableByUpdate("e6", ["u2"]), true);
  // time_moved and room_changed do not make unavailable
  assert.equal(isUnavailableByUpdate("e1", ["u3"]), false);
  assert.equal(isUnavailableByUpdate("e9", ["u4"]), false);
  // Not applied
  assert.equal(isUnavailableByUpdate("e3", []), false);
});

test("appliedUpdates returns correct subset", () => {
  const result = appliedUpdates(["u1", "u3"]);
  assert.equal(result.length, 2);
  assert.ok(result.some((u) => u.id === "u1"));
  assert.ok(result.some((u) => u.id === "u3"));
});

test("updatesInLatestBatch shows most-recently applied batch", () => {
  // Apply batch 1 IDs only
  const batch1Ids = ALL_BATCHES[0].updates.map((u) => u.id);
  const { batch, updates } = updatesInLatestBatch(batch1Ids);
  assert.ok(batch !== null);
  assert.equal(batch!.batch, ALL_BATCHES[0].batch);
  assert.equal(updates.length, ALL_BATCHES[0].updates.length);
});

test("updatesInLatestBatch returns empty when nothing applied", () => {
  const { batch, updates } = updatesInLatestBatch([]);
  assert.equal(batch, null);
  assert.equal(updates.length, 0);
});

// ── Fix A: time_moved tests ──────────────────────────────────────────────────

test("kindLabel returns 'Time changed' for time_moved", () => {
  assert.equal(kindLabel("time_moved"), "Time changed");
});

test("effectiveEvents returns catalog when no updates applied", () => {
  const eff = effectiveEvents([]);
  // e1 should have its original start=900, end=990
  const e1 = eff.find((e) => e.id === "e1");
  assert.ok(e1, "e1 must exist");
  assert.equal(e1!.start, 900);
  assert.equal(e1!.end, 990);
});

test("effectiveEvents applies time_moved u3 to e1", () => {
  // u3 moves e1: new_start=630, new_end=720
  const eff = effectiveEvents(["u3"]);
  const e1 = eff.find((e) => e.id === "e1");
  assert.ok(e1, "e1 must exist");
  assert.equal(e1!.start, 630, "e1 start should be 630 after u3");
  assert.equal(e1!.end, 720, "e1 end should be 720 after u3");
  // Other events must be unchanged (spot-check e4)
  const e4 = eff.find((e) => e.id === "e4");
  const e4orig = effectiveEvents([]).find((e) => e.id === "e4");
  assert.equal(e4?.start, e4orig?.start);
});

test("issue detects conflict using effective times for time_moved event", () => {
  // u3 moves e1 to 630–720 on Tuesday (day=1).
  // A block from 600–690 on Tuesday overlaps with the new slot.
  const eff = effectiveEvents(["u3"]);
  const e1eff = eff.find((e) => e.id === "e1")!;
  const stateWithBlock: DemoState = {
    ...fresh(),
    plan: ["e1"],
    blocks: [
      { id: "b1", title: "Morning seminar", day: 1, start: 600, end: 690 },
    ],
    appliedUpdateIds: ["u3"],
  };
  const result = issue(e1eff, stateWithBlock, eff);
  assert.ok(result?.includes("Conflicts"), `expected conflict, got: ${result}`);
});

test("issue detects no conflict for time_moved event with no overlapping block", () => {
  const eff = effectiveEvents(["u3"]);
  const e1eff = eff.find((e) => e.id === "e1")!;
  const stateNoBlock: DemoState = {
    ...fresh(),
    plan: ["e1"],
    blocks: [],
    appliedUpdateIds: ["u3"],
  };
  const result = issue(e1eff, stateNoBlock, eff);
  assert.equal(result, null, `expected no conflict, got: ${result}`);
});

test("recommend excludes time_moved event that conflicts with a block", () => {
  // u3 moves e1 to 630–720 on Tuesday. A block 600–690 blocks it.
  const eff = effectiveEvents(["u3"]);
  const stateWithBlock: DemoState = {
    ...fresh(),
    plan: [],
    interests: ["AI & education"],
    blocks: [
      { id: "b1", title: "Morning seminar", day: 1, start: 600, end: 690 },
    ],
    appliedUpdateIds: ["u3"],
  };
  const selected = recommend(stateWithBlock, {}, 3, true, eff);
  assert.ok(
    !selected.some((e) => e.id === "e1"),
    `e1 must not be recommended after time_moved conflict; got: ${selected.map((e) => e.id).join(", ")}`,
  );
});

test("applyNextBatch detects movedConflicts for time_moved into block", () => {
  // Start from batch 1 applied (so batch 2 with u3 time_moved is next).
  const batch1Ids = ALL_BATCHES[0].updates.map((u) => u.id);
  const stateWithBlock: DemoState = {
    ...fresh(),
    plan: ["e1"],
    blocks: [
      { id: "b1", title: "Morning seminar", day: 1, start: 600, end: 690 },
    ],
    appliedUpdateIds: batch1Ids,
  };
  const { movedConflicts } = applyNextBatch(stateWithBlock);
  assert.ok(
    movedConflicts.includes("e1"),
    `e1 should be a movedConflict; got: ${movedConflicts.join(", ")}`,
  );
});

test("applyNextBatch reports no movedConflicts when moved event has no block overlap", () => {
  const batch1Ids = ALL_BATCHES[0].updates.map((u) => u.id);
  const stateNoProblem: DemoState = {
    ...fresh(),
    plan: ["e1"],
    blocks: [], // no blocks → no conflict with new slot 630–720
    appliedUpdateIds: batch1Ids,
  };
  const { movedConflicts } = applyNextBatch(stateNoProblem);
  assert.ok(
    !movedConflicts.includes("e1"),
    `e1 should not be a movedConflict with no blocks; got: ${movedConflicts.join(", ")}`,
  );
});

test("a full update blocks the event everywhere issue() is used", () => {
  const { nextState } = applyNextBatch({ ...fresh(), plan: ["e6"] });
  assert.ok(nextState.appliedUpdateIds.includes("u2"));
  assert.ok(!nextState.cancelled.includes("e6"));
  const e6 = effectiveEvents(nextState.appliedUpdateIds).find(
    (e) => e.id === "e6",
  )!;
  assert.equal(e6.access, "full");
  // Event cards and enrollment call issue() with the raw catalog event.
  const raw = recommend(
    { ...fresh(), interests: ["Social"] },
    {
      mode: "discovery",
      topics: ["Social"],
      days: [1],
      after: 1080,
      before: 1170,
    },
    48,
  ).find((e) => e.id === "e6");
  assert.ok(raw, "e6 is recommendable before the update");
  assert.equal(issue(raw, { ...nextState, plan: [] }), "Event is full");
  // The plan-changed banner and replacement flow see the planned event as unavailable.
  assert.equal(issue(e6, nextState), "Event is full");
  // Dashboard and planner recommendations exclude it.
  assert.ok(
    !recommend({ ...nextState, plan: [], interests: ["Social"] }, {}, 48).some(
      (e) => e.id === "e6",
    ),
  );
});

test("issue() checks a moved event at its new time without an events override", () => {
  const e1 = effectiveEvents([]).find((e) => e.id === "e1")!;
  const state = {
    ...fresh(),
    plan: [],
    blocks: [
      {
        id: "b-test",
        title: "Morning seminar",
        day: e1.day,
        start: 600,
        end: 690,
      },
    ],
    buffer: 0,
  };
  assert.equal(issue(e1, state), null, "original slot does not conflict");
  assert.match(
    issue(e1, { ...state, appliedUpdateIds: ["u3"] }) ?? "",
    /Morning seminar/,
  );
});
