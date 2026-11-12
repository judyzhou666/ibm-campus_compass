import assert from "node:assert/strict";
import { test } from "node:test";
import { EVENTS } from "../frontend/src/data.ts";
import { fresh } from "../frontend/src/state.ts";
import { issue } from "../frontend/src/planner.ts";
import { allNotifications } from "../frontend/src/notifications.ts";
import {
  HOME_CATEGORIES,
  announcements,
  categoryCount,
  createWheelSwipe,
  hasPreferences,
  homeRecommendations,
  recommendationBasis,
} from "../frontend/src/home.ts";

test("announcements only link to catalog events", () => {
  const list = announcements(allNotifications([]));
  assert.ok(list.length > 0);
  for (const n of list) assert.ok(EVENTS.some((e) => e.id === n.eventId));
});

test("every category quick entry opens a non-empty Explore filter", () => {
  for (const c of HOME_CATEGORIES)
    assert.ok(categoryCount(c.filter) > 0, `${c.label} has no events`);
});

test("a fresh profile has no stated preferences and gets the default mix", () => {
  const state = fresh();
  assert.equal(hasPreferences(state), false);
  const recs = homeRecommendations(state);
  assert.equal(recs.personalized, false);
  assert.equal(recs.events.length, 8);
  // The default mix spans several categories rather than one.
  assert.ok(new Set(recs.events.map((e) => e.category)).size >= 4);
  assert.match(recommendationBasis(state, false), /Popular picks/);
});

test("stated preferences rank matching events first", () => {
  const state = { ...fresh(), interests: ["Wellbeing"] };
  assert.equal(hasPreferences(state), true);
  const recs = homeRecommendations(state);
  assert.equal(recs.personalized, true);
  assert.equal(recs.events[0].topic, "Wellbeing");
  assert.match(recommendationBasis(state, true), /Wellbeing/);
});

test("recommendations are catalog events the student can still add", () => {
  const state = { ...fresh(), plan: ["e1"], goal_types: ["research"] };
  for (const e of homeRecommendations(state).events) {
    assert.ok(EVENTS.includes(e), "same objects Explore Events shows");
    assert.notEqual(e.id, "e1");
    assert.equal(issue(e, state), null);
  }
});

/** A swipe: deltas ramp up, then a long momentum tail decays (16 ms apart). */
function gesture(sign: number, start: number) {
  const ramp = [6, 14, 24, 32, 28];
  const tail = Array.from({ length: 60 }, (_, i) => 26 * 0.94 ** i);
  return [...ramp, ...tail].map((d, i) => ({
    dx: sign * d,
    t: start + i * 16,
  }));
}
const run = (
  swipe: ReturnType<typeof createWheelSwipe>,
  events: { dx: number; t: number }[],
) => events.map((e) => swipe(e.dx, 0, e.t)).filter((s) => s !== 0);

test("one trackpad swipe, momentum included, steps exactly once", () => {
  const swipe = createWheelSwipe();
  assert.deepEqual(run(swipe, gesture(1, 0)), [1]);
  assert.deepEqual(run(swipe, gesture(-1, 0 + 2000)), [-1]);
});

test("repeated swipes step freely, even during the previous momentum", () => {
  const swipe = createWheelSwipe();
  // Three swipes left, each starting while the last one's momentum still runs.
  const left = [0, 400, 800].flatMap((t, i, all) =>
    gesture(1, t).filter((e) => i === all.length - 1 || e.t < all[i + 1]),
  );
  assert.deepEqual(run(swipe, left), [1, 1, 1]);
  // Then reverse immediately: two swipes right.
  const right = [1000, 1400].flatMap((t, i, all) =>
    gesture(-1, t).filter((e) => i === all.length - 1 || e.t < all[i + 1]),
  );
  assert.deepEqual(run(swipe, right), [-1, -1]);
});

test("vertical scrolling never changes the announcement", () => {
  const swipe = createWheelSwipe();
  for (let i = 0; i < 30; i++) assert.equal(swipe(3, 60, i * 16), 0);
});
