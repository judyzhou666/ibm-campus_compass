import { test } from "node:test";
import assert from "node:assert/strict";
import { EVENTS } from "../frontend/src/data.ts";
import { fresh, restore, STORAGE_KEY } from "../frontend/src/state.ts";
import { recommend, issue } from "../frontend/src/planner.ts";
import {
  replacementConstraints,
  constraintSummary,
} from "../frontend/src/replanning.ts";

test("synthetic provenance never claims external verification", () => {
  for (const e of EVENTS) {
    assert.equal(e.campus_id, "fictional-campus");
    assert.equal(e.source_url, null);
    assert.equal(e.last_checked_at, null);
    assert.match(e.verification_status!, /not externally verified/);
    assert.ok(
      ["Full meal", "Refreshments", "Paid food", "None", "Unknown"].includes(
        e.food_status!,
      ),
    );
  }
});
test("replanning preserves every original constraint and never adds a replacement", () => {
  const state = { ...fresh(), plan: ["e1", "e3"], cancelled: ["e1"] };
  const previous = {
    days: [1],
    after: 900,
    before: 990,
    food: "Coffee & snacks",
    free: true,
    excluded: ["Career"],
  };
  const c = replacementConstraints(previous, EVENTS[0]);
  assert.deepEqual(c, { ...previous, topics: ["AI & education"], limit: 1 });
  assert.deepEqual(recommend({ ...state, plan: ["e3"] }, c), []);
  assert.deepEqual(state.plan, ["e1", "e3"]);
  assert.match(constraintSummary(c), /Tuesday/);
});
test("preferred times rank options without overriding strict filters or eligibility", () => {
  const s = { ...fresh(), interests: [], preferred_time: "evening" };
  const matches = recommend(s, { days: [3], after: 1020 });
  assert.ok(matches.length);
  for (const e of matches) {
    assert.equal(e.day, 3);
    assert.ok(e.start >= 1020);
    assert.equal(issue(e, s), null);
  }
  assert.match(
    issue({ ...EVENTS[0], access: "unrecognized" }, s)!,
    /Eligibility/,
  );
});
test("legacy local state gains safe onboarding defaults; malformed preferences are ignored", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => {
        assert.equal(key, STORAGE_KEY);
        return JSON.stringify({
          plan: ["e1"],
          preferred_time: "invalid",
          interests: ["Social"],
        });
      },
    },
  });
  try {
    const s = restore();
    assert.deepEqual(s.plan, ["e1"]);
    assert.equal(s.preferred_time, "any");
    assert.equal(s.onboarded, false);
    assert.equal(s.major, "");
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
