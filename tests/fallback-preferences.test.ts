import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh } from "../frontend/src/state.ts";
import { EVENTS } from "../frontend/src/data.ts";
import {
  GOAL_TOPICS,
  defaultPreferences,
} from "../frontend/src/preferences.ts";
import {
  RANKING_WEIGHTS,
  rankingDetails,
  recommend,
  recommendWithReasons,
  issue,
  overlap,
} from "../frontend/src/planner.ts";
import { requestPlan } from "../frontend/src/api.ts";
const offline: typeof fetch = async () => {
  throw Error("offline");
};
const student = (): ReturnType<typeof fresh> & {
  preferences: ReturnType<typeof defaultPreferences>;
} => ({
  ...fresh(),
  interests: [],
  preferences: defaultPreferences(),
});
test("explicit scoring weights and goal mapping are auditable and do not infer arbitrary goals", () => {
  assert.deepEqual(RANKING_WEIGHTS, {
    topic: 10,
    diversity: 4,
    learning: 6,
    goal: 3,
    primary: 2,
    participation: 2,
    preferred_time: 2,
    free: 1,
  });
  assert.deepEqual(GOAL_TOPICS, {
    career: ["Career"],
    practice: ["AI & education"],
    research: ["AI & education"],
    people: ["Social"],
    discover: [],
    wellbeing: ["Wellbeing"],
    unsure: [],
    other: [],
  });
  const s = student();
  s.interests = ["Career"];
  Object.assign(s.preferences, {
    goals: ["career"],
    primary_goal: "career",
    use_goals: true,
    learning_topics: [{ topic: "Career", source: "Added by you" }],
    use_learning: true,
    participation: ["one-to-one"],
  });
  s.preferred_time = "afternoon";
  const e = {
    ...EVENTS[0],
    topic: "Career",
    participation: "one-to-one" as const,
    cost: 0,
    start: 780,
    end: 840,
  };
  const result = rankingDetails(e, s);
  assert.equal(result.score, 30);
  assert.deepEqual(
    result.matches.map((m) => m.kind),
    Object.keys(RANKING_WEIGHTS),
  );
  assert.equal(rankingDetails(e, s, {}, [e]).score, 26);
  s.preferences.use_goals = false;
  s.preferences.use_learning = false;
  assert.ok(
    rankingDetails(e, s).matches.every(
      (m) => !["goal", "primary", "learning"].includes(m.kind),
    ),
  );
});
test("unknown participation and unsupported raw notes never add ranking points", () => {
  const s = student();
  s.preferences.participation = ["independent"];
  const e = { ...EVENTS[0], participation: "unknown" as const };
  const before = rankingDetails(e, s);
  Object.assign(s.preferences, {
    why: "Career UX",
    learning_note: "Research AI",
    next_note: "Figma design",
    custom_interest: "wellbeing",
    location_note: "near me",
    format_note: "small group",
  });
  s.goals = "Research career";
  s.major = "Design";
  assert.deepEqual(rankingDetails(e, s), before);
  assert.ok(!before.matches.some((m) => m.kind === "participation"));
  assert.ok(
    !rankingDetails({ ...e, participation: undefined }, s).matches.some(
      (m) => m.kind === "participation",
    ),
  );
});
test("current topics replace defaults without changing saved preferences or relaxing hard constraints", async () => {
  const s = student();
  s.interests = ["Career"];
  s.preferences.free_only = true;
  s.preferences.windows = [{ day: 2, start: 1020, end: 1200 }];
  const before = structuredClone(s);
  assert.deepEqual(recommend(s, { topics: ["Arts & culture"] }), []);
  const result = await requestPlan("arts on Wednesday evening", {}, s, offline);
  assert.deepEqual(result.ids, []);
  assert.deepEqual(s, before);
  s.preferences.free_only = false;
  const matches = recommendWithReasons(s, { topics: ["Arts & culture"] });
  assert.ok(matches.length);
  assert.ok(
    matches.every(
      ({ event }) => event.topic === "Arts & culture" && !issue(event, s),
    ),
  );
  assert.ok(
    matches.every(({ matches }) =>
      matches
        .find((m) => m.kind === "topic")
        ?.explanation.includes("this search"),
    ),
  );
});
test("saved result counts and explicit current limits use the same offline recommendation path", async () => {
  for (const count of [1, 3, 5] as const) {
    const s = student();
    s.preferences.count = count;
    const result = await requestPlan("Find events", {}, s, offline);
    assert.equal(result.source, "browser-fallback");
    assert.equal(result.ids.length, count);
    assert.deepEqual(
      result.ids,
      recommend(s).map((e) => e.id),
    );
    assert.equal(result.matchReasons?.length, count);
    assert.deepEqual(result.evidence, []);
    for (const r of result.matchReasons || [])
      assert.equal(
        r.score,
        r.matches.reduce((sum, m) => sum + m.points, 0),
      );
    assert.equal(recommend(s, { limit: 2 }).length, 2);
    assert.equal(
      (await requestPlan("Find events", { limit: 2 }, s, offline)).ids.length,
      2,
    );
  }
});
test("hard eligibility, cancellations, entered commitments and pairwise buffers survive personalization", () => {
  const s = student();
  s.preferences.count = 5;
  s.preferences.goals = ["career", "research"];
  s.preferences.use_goals = true;
  s.preferences.free_only = true;
  s.cancelled = ["e1"];
  const selected = recommend(s);
  assert.ok(selected.length);
  assert.ok(
    selected.every(
      (e) =>
        !issue(e, s) && e.cost === 0 && e.id !== "e1" && e.access === "open",
    ),
  );
  for (let i = 0; i < selected.length; i++)
    for (const other of selected.slice(i + 1))
      assert.equal(overlap(selected[i], other, s.buffer), false);
});
test("stable day/start/ID ordering is independent of input catalog order", () => {
  const s = student();
  const original = [...EVENTS];
  const ids = recommend(s).map((e) => e.id);
  try {
    EVENTS.reverse();
    assert.deepEqual(
      recommend(s).map((e) => e.id),
      ids,
    );
    s.blocks = [];
    const twin = { ...original[0], id: "tie-b" };
    EVENTS.splice(0, EVENTS.length, twin, { ...twin, id: "tie-a" });
    assert.deepEqual(
      recommend(s).map((e) => e.id),
      ["tie-a"],
    );
    EVENTS.reverse();
    assert.deepEqual(
      recommend(s).map((e) => e.id),
      ["tie-a"],
    );
  } finally {
    EVENTS.splice(0, EVENTS.length, ...original);
  }
});
