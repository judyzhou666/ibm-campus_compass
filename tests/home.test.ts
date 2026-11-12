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
