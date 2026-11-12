import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO,
  validateDemoConfig,
  weekDates,
  utcStamp,
  storageKey,
  dayLabel,
} from "../frontend/src/config.ts";
import { EVENTS, when } from "../frontend/src/data.ts";
import { fresh } from "../frontend/src/state.ts";
import { recommend, issue, overlap } from "../frontend/src/planner.ts";
import { interpretRequest } from "../frontend/src/interpretation.ts";
import { guidedScenario, GUIDED_PROMPT } from "../frontend/src/demoScenario.ts";
import { qualityIssues } from "../frontend/src/quality.ts";
import { measure } from "../evaluation/metrics.ts";

test("demo config validates Mondays and zones, isolates previous storage, and crosses DST correctly", () => {
  assert.deepEqual(weekDates(), [
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
  ]);
  // 2026-11-03: US DST ended Nov 1, so EST (-5); 15:00 local = 20:00 UTC
  assert.equal(utcStamp(1, 900), "20261103T200000Z");
  const utc = { ...DEMO, time_zone: "UTC" };
  assert.equal(utcStamp(1, 900, utc), "20261103T150000Z");
  // A different week produces a different storage key
  const oldWeek = { ...DEMO, week_start: "2026-10-19" };
  assert.notEqual(storageKey(oldWeek), storageKey());
  assert.notEqual(storageKey(utc), storageKey());
  assert.throws(() =>
    validateDemoConfig({ ...DEMO, week_start: "2026-10-20" }),
  );
  assert.throws(() =>
    validateDemoConfig({ ...DEMO, time_zone: "Invalid/Zone" }),
  );
  // day=0 midnight+1440 wraps to next calendar day in EST
  assert.equal(utcStamp(0, 1440), "20261103T050000Z");
});
test("multiple expressed interests get diverse feasible options without relaxing filters", () => {
  const s = fresh(),
    c = interpretRequest("AI career social events").constraints;
  const picked = recommend(s, c);
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map((e) => e.topic)).size, 3);
  for (let i = 0; i < picked.length; i++) {
    assert.equal(issue(picked[i], s), null);
    for (let j = 0; j < i; j++)
      assert.equal(overlap(picked[i], picked[j], s.buffer), false);
  }
  assert.deepEqual(recommend(s, { ...c, days: [5, 6] }), []);
});
test("ambiguity needs clarification, while unsupported and understood-empty stay distinct", () => {
  assert.match(interpretRequest("career after 3").clarification!, /AM or PM/);
  assert.match(interpretRequest("events near me").clarification!, /weekdays/);
  assert.match(
    interpretRequest("social but not Tuesday").clarification!,
    /days/,
  );
  assert.equal(interpretRequest("purple flying giraffes").understood, false);
  const q = interpretRequest("weekend events");
  assert.equal(q.understood, true);
  assert.deepEqual(recommend(fresh(), q.constraints), []);
});
test("data review reports honest missing sources and invalid metadata without mutating catalog", () => {
  const e = EVENTS[0],
    before = JSON.stringify(e);
  // All events now have source_url, last_checked_at, host_school and goal_type populated.
  assert.ok(!qualityIssues(e).includes("Missing original URL"));
  assert.ok(!qualityIssues(e).includes("Unverified or stale"));
  assert.ok(!qualityIssues(e).includes("Missing host school"));
  assert.ok(!qualityIssues(e).includes("Missing goal type"));
  assert.equal(JSON.stringify(e), before);
  // Synthesised invalid record covering each check
  const invalid = {
    ...e,
    source: "",
    source_url: null as null | string,
    last_checked_at: null as null | string,
    host_school: "",
    goal_type: [] as string[],
    rsvp: "Unknown",
    access: "unknown",
    food: "Unknown",
    start: 990,
    end: 900,
  };
  // Missing source, Missing original URL, Unverified or stale, Unknown eligibility,
  // Unclear RSVP, Unknown food, Missing host school, Missing goal type, Invalid metadata = 9
  assert.equal(qualityIssues(invalid).length, 9);
  assert.match(issue(invalid, fresh())!, /metadata/);
  assert.match(
    issue({ ...e, rsvp: "Unknown" }, fresh())!,
    /RSVP requirements unknown/,
  );
});
test("invalid catalog days stay inspectable instead of crashing event details", () => {
  for (const day of [-1, 5, 7, 1.5, NaN]) {
    const event = { ...EVENTS[0], day };
    assert.ok(qualityIssues(event).includes("Invalid metadata"));
    assert.equal(dayLabel(day), "Date needs review");
    assert.match(when(event), /Unknown day, Date needs review/);
  }
  assert.match(when(EVENTS[0]), /^Tue, Nov 3/);
});
test("guided scenario is resettable, limited, and never grants enrollment or RSVP", () => {
  const a = guidedScenario(),
    b = guidedScenario();
  a.plan.push("e1");
  assert.deepEqual(b.plan, []);
  assert.deepEqual(b.rsvps, []);
  assert.ok(b.blocks.length);
  assert.ok(b.interests.includes("Social"));
  assert.ok(
    recommend(b, interpretRequest(GUIDED_PROMPT).constraints).length >= 3,
  );
});
test("evaluation denominators handle five results, abstention, and unsafe keyword retrieval", () => {
  const state = fresh(),
    s = {
      id: "test",
      split: "test",
      description: "five options",
      message: "AI career arts 5 events",
      expected_topics: ["AI & education", "Career", "Arts & culture"],
    };
  const ids = recommend(state, { topics: s.expected_topics, limit: 5 }).map(
    (e) => e.id,
  );
  const m = measure(s, state, {
    ids,
    status: "matched",
    evidence: [],
    food: Object.fromEntries(EVENTS.map((e) => [e.id, e.food])),
  });
  assert.equal(m.recall.denominator, 5);
  assert.ok(m.recall.numerator <= m.recall.denominator);
  assert.equal(m.source_faithfulness.denominator, 0);
  assert.equal(m.explanation_quality.numerator, 0);
  const unsafe = measure({ ...s, constraints: { days: [1] } }, state, {
    ids: ["e4", "e12"],
    status: "matched",
    evidence: [],
    food: { e4: "Free meal", e12: "None" },
  });
  assert.equal(unsafe.conflict_violations.numerator, 1);
  assert.equal(unsafe.eligibility_violations.numerator, 1);
  assert.equal(unsafe.food_accuracy.numerator, 1);
  assert.equal(unsafe.constraint_satisfaction.numerator, 1);
});
