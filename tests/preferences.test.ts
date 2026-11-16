import assert from "node:assert/strict";
import test from "node:test";
import { prefsDiffer, type Preferences } from "../frontend/src/preferences.ts";
import { fresh } from "../frontend/src/state.ts";
import { GOAL_TYPES } from "../frontend/src/types.ts";

const saved: Preferences = {
  interests: ["Career", "AI & education"],
  goal_types: [GOAL_TYPES[0], GOAL_TYPES[1]],
  goals: "Explore AI research",
  preferred_time: "any",
};
const changed = (draft: Preferences, baseline = saved) =>
  prefsDiffer(
    draft.interests,
    draft.goal_types,
    draft.goals,
    draft.preferred_time,
    baseline,
  );

test("identical preference values in separate objects are unchanged", () => {
  assert.equal(changed(structuredClone(saved)), false);
});

test("interest selection order does not affect dirty state", () => {
  assert.equal(
    changed({ ...saved, interests: [...saved.interests].reverse() }),
    false,
  );
});

test("goal-type selection order does not affect dirty state", () => {
  assert.equal(
    changed({ ...saved, goal_types: [...saved.goal_types].reverse() }),
    false,
  );
});

test("adding or removing interests changes dirty state", () => {
  for (const interests of [
    [...saved.interests, "Social"],
    saved.interests.slice(1),
    [],
  ])
    assert.equal(changed({ ...saved, interests }), true);
});

test("adding or removing goal types changes dirty state", () => {
  for (const goal_types of [
    [...saved.goal_types, GOAL_TYPES[2]],
    saved.goal_types.slice(1),
    [],
  ])
    assert.equal(changed({ ...saved, goal_types }), true);
});

test("goals use the same trim semantics as Save, on both sides", () => {
  const padded = { ...saved, goals: " \tExplore AI research\n " };
  assert.equal(changed(padded), false);
  assert.equal(changed(saved, padded), false);
});

test("meaningful goal content, internal whitespace and clearing are changes", () => {
  for (const goals of ["Explore career options", "Explore  AI research", ""])
    assert.equal(changed({ ...saved, goals }), true);
});

test("any matches itself and changing to each existing time option is detected", () => {
  assert.equal(changed({ ...saved, preferred_time: "any" }), false);
  for (const preferred_time of ["morning", "afternoon", "evening"]) {
    const draft = { ...saved, preferred_time };
    assert.equal(changed(draft), true);
    assert.equal(changed(draft, structuredClone(draft)), false);
  }
});

test("reverting every edited field returns to unchanged", () => {
  const draft = structuredClone(saved);
  draft.interests.push("Social");
  draft.goal_types.push(GOAL_TYPES[2]);
  draft.goals = "New goal";
  draft.preferred_time = "evening";
  assert.equal(changed(draft), true);
  draft.interests = [...saved.interests].reverse();
  draft.goal_types = [...saved.goal_types].reverse();
  draft.goals = " Explore AI research ";
  draft.preferred_time = saved.preferred_time;
  assert.equal(changed(draft), false);
});

test("empty selections and blank goals remain legitimate values", () => {
  const empty: Preferences = {
    interests: [],
    goal_types: [],
    goals: "",
    preferred_time: "any",
  };
  assert.equal(changed(structuredClone(empty), empty), false);
  assert.equal(changed({ ...empty, goals: " \n\t " }, empty), false);
  assert.equal(changed({ ...empty, interests: ["Career"] }, empty), true);
  assert.equal(changed({ ...empty, goal_types: [GOAL_TYPES[0]] }, empty), true);
  assert.equal(changed({ ...empty, goals: "A goal" }, empty), true);
});

test("the actual fresh-state defaults compare unchanged", () => {
  const state = fresh();
  const defaults: Preferences = {
    interests: state.interests,
    goal_types: state.goal_types,
    goals: state.goals,
    preferred_time: state.preferred_time || "any",
  };
  assert.equal(changed(structuredClone(defaults), defaults), false);
});

test("comparison never sorts or mutates the caller's arrays or snapshots", () => {
  const baseline = structuredClone(saved);
  const draft = {
    ...structuredClone(saved),
    interests: [...saved.interests].reverse(),
    goal_types: [...saved.goal_types].reverse(),
  };
  const before = structuredClone({ draft, baseline });
  Object.freeze(draft.interests);
  Object.freeze(draft.goal_types);
  Object.freeze(baseline.interests);
  Object.freeze(baseline.goal_types);
  assert.equal(changed(draft, baseline), false);
  assert.deepEqual({ draft, baseline }, before);
});
