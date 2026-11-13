/** Regression tests for the PR #17 review findings. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { EVENTS } from "../frontend/src/data.ts";
import { fresh } from "../frontend/src/state.ts";
import { matchesExplore, selectionFor } from "../frontend/src/filters.ts";

const matchesFilter = (e: (typeof EVENTS)[number], f: string) =>
  matchesExplore(e, selectionFor(f));
import { posterTone } from "../frontend/src/components.tsx";
import { categoryCount, withUpdates } from "../frontend/src/home.ts";
import { bufferBlocker } from "../frontend/src/settings.ts";

const event = (id: string) => EVENTS.find((e) => e.id === id)!;

test("announcement time and room follow applied synthetic updates", () => {
  // u3 moves e1 to 10:30 AM; u4 moves e9 to another room.
  assert.equal(withUpdates(event("e1"), ["u3"]).start, 630);
  assert.equal(
    withUpdates(event("e9"), ["u4"]).location,
    "Innovation Hub, Room 3",
  );
  // No update applied: catalog values.
  assert.equal(withUpdates(event("e1"), []).start, event("e1").start);
  // Conflicting notices (u5 cancel + u6 room) keep the catalog room.
  assert.equal(
    withUpdates(event("e5"), ["u5", "u6"]).location,
    event("e5").location,
  );
});

test("Arts and Wellbeing chips include events filed under another category", () => {
  const arts = EVENTS.filter((e) => matchesFilter(e, "Arts & Creative"));
  assert.ok(arts.some((e) => e.title === "Film club evening"));
  assert.ok(arts.some((e) => e.title === "Ceramics beginner workshop"));
  assert.ok(!arts.some((e) => e.category === "Career"));
  const wellbeing = EVENTS.filter((e) => matchesFilter(e, "Wellbeing"));
  assert.ok(wellbeing.some((e) => e.title === "Wednesday noon run"));
  // Home counts use the same predicate as Explore.
  for (const f of ["Academic & Research", "Arts & Creative", "Wellbeing", "Free food"])
    assert.equal(
      categoryCount(f),
      EVENTS.filter((e) => matchesFilter(e, f)).length,
    );
  assert.equal(
    EVENTS.filter((e) => matchesFilter(e, "All")).length,
    EVENTS.length,
  );
});

test("poster tone is shared: arts topics read as arts", () => {
  assert.equal(posterTone(event("e13")), "arts"); // Social, Arts & culture
  assert.equal(posterTone(event("e7")), "career");
});

test("travel buffer switch is not locked by a full or cancelled plan event", () => {
  // e6 planned, then marked full by u2: not the buffer's doing.
  const full = {
    ...fresh(),
    buffer: 0,
    plan: ["e6"],
    appliedUpdateIds: ["u2"],
  };
  assert.equal(bufferBlocker(full), undefined);
  // Turning the buffer off never blocks.
  assert.equal(bufferBlocker({ ...full, buffer: 15 }), undefined);
});

test("travel buffer switch still refuses to create a new clash", () => {
  // Find a planned event that only clashes once 15 minutes are added.
  const base = { ...fresh(), buffer: 0 };
  const clash = EVENTS.find(
    (e) => bufferBlocker({ ...base, plan: [e.id] }) !== undefined,
  );
  assert.ok(clash, "the catalog has an event next to a class");
  assert.equal(bufferBlocker({ ...base, plan: [clash.id] })?.id, clash.id);
});
