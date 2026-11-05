import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, createStore } from "../frontend/src/state.ts";
import {
  newBusyConflicts,
  busyConflictWarning,
} from "../frontend/src/busyCommitments.ts";
import { recommend, issue } from "../frontend/src/planner.ts";
import { createEnrollment } from "../frontend/src/enrollment.ts";
import { EVENTS } from "../frontend/src/data.ts";
const block = {
  id: "actual-class",
  title: "Actual seminar",
  day: 1,
  start: 900,
  end: 975,
};
const offline: typeof fetch = async () => {
  throw Error("offline");
};
test("new commitments warn against latest planned events without changing plans or RSVP", () => {
  const s = { ...fresh(), plan: ["e1"], rsvps: ["e1"] },
    before = structuredClone(s);
  const conflicts = newBusyConflicts(s, [...s.blocks, block], s.buffer);
  assert.deepEqual(
    conflicts.map((c) => c.event.id),
    ["e1"],
  );
  assert.match(busyConflictWarning(conflicts), /RSVP records will stay/);
  assert.match(
    busyConflictWarning(conflicts),
    /Nothing will be removed, replaced or cancelled/,
  );
  assert.deepEqual(s, before);
  assert.deepEqual(
    newBusyConflicts({ ...s, plan: [] }, [...s.blocks, block], s.buffer),
    [],
  );
  assert.equal(newBusyConflicts(s, [...s.blocks, block], s.buffer).length, 1);
});
test("acknowledged conflicts do not block later saves; increasing travel buffer warns on newly introduced conflicts", () => {
  const s = { ...fresh(), plan: ["e1"], rsvps: ["e1"], blocks: [block] };
  assert.deepEqual(newBusyConflicts(s, s.blocks, s.buffer), []);
  const gap = { ...block, end: 890, start: 840 };
  const before = { ...s, blocks: [gap], buffer: 0 };
  assert.equal(newBusyConflicts(before, before.blocks, 15).length, 1);
  assert.deepEqual(newBusyConflicts(before, before.blocks, 0), []);
});
test("saved busy time excludes future recommendations in both modes while planned state remains", () => {
  const s = { ...fresh(), plan: ["e1"], rsvps: ["e1"] };
  const saved = { ...s, blocks: [...s.blocks, block] };
  for (const mode of ["discovery", "plan-building"] as const)
    assert.deepEqual(
      recommend(saved, { mode, days: [1], after: 900, before: 1020, limit: 5 }),
      [],
    );
  assert.match(
    issue(
      EVENTS.find((e) => e.id === "e1")!,
      saved,
    )!,
    /Actual seminar/,
  );
  assert.deepEqual(saved.plan, ["e1"]);
  assert.deepEqual(saved.rsvps, ["e1"]);
});
test("RSVP confirmation revalidates a newly saved commitment before adding", async () => {
  const demo = createStore(fresh()),
    enroll = createEnrollment(demo, offline);
  assert.equal((await enroll.choose("e1")).kind, "rsvp");
  demo.update((s) => ({ ...s, blocks: [...s.blocks, block] }));
  assert.equal(
    (await enroll.confirm({ display_name: "Demo", attending: true })).kind,
    "rejected",
  );
  assert.deepEqual(demo.read().plan, []);
  assert.deepEqual(demo.read().rsvps, []);
});
