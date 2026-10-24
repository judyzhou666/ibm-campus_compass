import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  restore,
  STORAGE_KEY,
  createStore,
} from "../frontend/src/state.ts";
import {
  defaultPreferences,
  migratePreferences,
  wirePreferences,
  clearPersonalization,
  guidanceText,
  suggestedTopics,
  fitReasons,
} from "../frontend/src/preferences.ts";
import { recommend, issue } from "../frontend/src/planner.ts";
import { EVENTS } from "../frontend/src/data.ts";
import { requestPlan, schedulePayload } from "../frontend/src/api.ts";
import { createConversation } from "../frontend/src/conversation.ts";
import { createEnrollment } from "../frontend/src/enrollment.ts";
const offline: typeof fetch = async () => {
  throw Error("offline");
};
function learner() {
  return {
    ...fresh(),
    interests: [],
    preferences: { ...defaultPreferences(), count: 1 as const },
  };
}
test("legacy migration preserves notes and unrelated data without inventing learning consent", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const legacy = {
    ...fresh(),
    preferences: undefined,
    interests: ["Arts & culture"],
    preferred_time: "evening",
    buffer: 0,
    blocks: [
      {
        id: "legacy-class",
        title: "Existing class",
        day: 2,
        start: 600,
        end: 660,
      },
    ],
    cancelled: ["e5"],
    major: "Existing major",
    goals: "Existing raw goal",
    plan: ["e1"],
    rsvps: ["e1"],
    saved: ["e3"],
    joinedCommunities: ["ai"],
    posts: [{ name: "Demo", title: "hello", body: "local", tag: "demo" }],
    messages: [{ role: "user", text: "history" }],
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify(legacy) },
  });
  try {
    const s = restore();
    assert.equal(s.major, legacy.major);
    assert.equal(s.goals, legacy.goals);
    assert.equal(s.preferred_time, legacy.preferred_time);
    assert.equal(s.buffer, legacy.buffer);
    for (const k of [
      "interests",
      "blocks",
      "cancelled",
      "plan",
      "rsvps",
      "saved",
      "joinedCommunities",
      "posts",
    ] as const)
      assert.deepEqual(s[k], legacy[k]);
    assert.equal(s.messages[0].text, "history");
    assert.deepEqual(s.preferences?.learning_topics, []);
    assert.equal(s.preferences?.use_goals, false);
    assert.equal(s.preferences?.use_learning, false);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
test("migration bounds fields and normalizes unsure, no preference and enum choices", () => {
  const p = migratePreferences({
    goals: ["career", "unsure"],
    primary_goal: "career",
    participation: ["unknown", "small-group"],
    count: 9,
    learning_note: "x".repeat(900),
    learning_topics: [{ topic: "fake", source: "Added by you" }],
  });
  assert.deepEqual(p.goals, ["unsure"]);
  assert.equal(p.primary_goal, "");
  assert.deepEqual(p.participation, ["small-group"]);
  assert.equal(p.count, 3);
  assert.equal(p.learning_note.length, 500);
  assert.deepEqual(p.learning_topics, []);
});
test("only confirmed enabled learning topics affect ranking, never raw notes", () => {
  const state = learner(),
    before = recommend(state).map((e) => e.id);
  state.preferences.learning_note = "Career research secret raw note";
  assert.deepEqual(
    recommend(state).map((e) => e.id),
    before,
  );
  state.preferences.learning_topics = [
    { topic: "Career", source: "Added by you" },
  ];
  state.preferences.use_learning = true;
  assert.deepEqual(
    recommend(state).map((e) => e.id),
    ["e20"],
  );
  assert.match(
    fitReasons(
      EVENTS.find((e) => e.id === "e20")!,
      state,
    ).join(" "),
    /confirmed Career/,
  );
  state.preferences.use_learning = false;
  assert.deepEqual(
    recommend(state).map((e) => e.id),
    before,
  );
  state.preferences.use_learning = true;
  state.preferences.learning_topics = [];
  assert.deepEqual(
    recommend(state).map((e) => e.id),
    before,
  );
  assert.deepEqual(suggestedTopics("unrecognized custom subject"), []);
});
test("goal mapping needs explicit opt-in and raw reflection never enters request payload", () => {
  const s = learner();
  s.preferences.goals = ["career"];
  s.preferences.primary_goal = "career";
  s.preferences.why = "PRIVATE_WHY";
  s.preferences.learning_note = "PRIVATE_LEARNING";
  s.major = "PRIVATE_MAJOR";
  s.goals = "PRIVATE_GOAL";
  assert.deepEqual(wirePreferences(s).goal_topics, []);
  s.preferences.use_goals = true;
  assert.deepEqual(
    recommend(s).map((e) => e.id),
    ["e20"],
  );
  const payload = JSON.stringify(schedulePayload(s));
  for (const marker of [
    "PRIVATE_WHY",
    "PRIVATE_LEARNING",
    "PRIVATE_MAJOR",
    "PRIVATE_GOAL",
    "learning_note",
    "primary_goal",
  ])
    assert.ok(!payload.includes(marker));
});
test("same topic with different participation and guidance produces distinct supported fit", () => {
  const a = {
      ...fresh(),
      interests: ["AI & education"],
      preferences: {
        ...defaultPreferences(),
        count: 1 as const,
        participation: ["independent"],
      },
    },
    b = {
      ...a,
      preferences: {
        ...a.preferences,
        participation: ["small-group"],
        guidance: "steps" as const,
      },
    };
  assert.deepEqual(
    recommend(a).map((e) => e.id),
    ["e18"],
  );
  assert.deepEqual(
    recommend(b).map((e) => e.id),
    ["e1"],
  );
  assert.match(guidanceText(b, EVENTS[0]), /1\./);
  assert.notEqual(guidanceText(a, EVENTS[0]), guidanceText(b, EVENTS[0]));
  const unknown = EVENTS.find((e) => e.participation === "unknown")!;
  assert.match(fitReasons(unknown, a).join(" "), /Unknown/);
});
test("saved count controls quantity and explicit topics cannot relax hard practical requirements", async () => {
  const s = {
    ...fresh(),
    preferences: {
      ...defaultPreferences(),
      count: 1 as const,
      free_only: true,
      windows: [{ day: 2, start: 1020, end: 1200 }],
    },
  };
  assert.deepEqual(recommend(s, { topics: ["Arts & culture"] }), []);
  const r = await requestPlan("arts on Wednesday evening", {}, s, offline);
  assert.deepEqual(r.ids, []);
  assert.match(
    issue(
      EVENTS.find((e) => e.id === "e29")!,
      s,
    )!,
    /free-admission/,
  );
  s.preferences.free_only = false;
  assert.deepEqual(
    recommend(s, { topics: ["Arts & culture"] }).map((e) => e.id),
    ["e29"],
  );
  const counted = {
    ...fresh(),
    preferences: { ...defaultPreferences(), count: 5 as const },
  };
  assert.equal(recommend(counted).length, 5);
  const one = {
    ...counted,
    preferences: { ...counted.preferences, count: 1 as const },
  };
  assert.equal(recommend(one).length, 1);
});
test("clearing personalization preserves plans, saved events, RSVP, conversations, communities and hard requirements", () => {
  const s = {
    ...fresh(),
    plan: ["e1"],
    rsvps: ["e1"],
    saved: ["e3"],
    messages: [{ role: "user" as const, text: "Keep conversation" }],
    joined: ["Keep discussion"],
    posts: [
      { name: "Demo", title: "Keep post", body: "Keep body", tag: "demo" },
    ],
    joinedCommunities: ["ai"],
    preferences: {
      ...defaultPreferences(),
      why: "private",
      free_only: true,
      windows: [{ day: 1, start: 900, end: 1000 }],
    },
  };
  const next = clearPersonalization(s);
  for (const k of [
    "plan",
    "rsvps",
    "saved",
    "blocks",
    "buffer",
    "joinedCommunities",
    "messages",
    "joined",
    "posts",
  ] as const)
    assert.deepEqual(next[k], s[k]);
  assert.deepEqual(next.interests, []);
  assert.equal(next.preferences?.why, "");
  assert.equal(next.preferences?.free_only, true);
  assert.deepEqual(next.preferences?.windows, s.preferences.windows);
});
test("preference changes invalidate pending results without restoring deleted inputs", async () => {
  const demo = createStore(fresh());
  let finish!: (r: Response) => void;
  const conversation = createConversation(
    demo,
    () => {},
    async () =>
      new Promise<Response>((r) => {
        finish = r;
      }),
  );
  const running = conversation.chat("Find events");
  demo.update((s) => ({
    ...s,
    preferences: { ...defaultPreferences(), use_learning: false },
    interests: [],
    constraints: {},
    draft: [],
  }));
  finish(
    Response.json({
      mode: "simulated",
      understood: true,
      constraints: { topics: ["Career"] },
      event_ids: ["e20"],
    }),
  );
  await running;
  assert.deepEqual(demo.read().interests, []);
  assert.deepEqual(demo.read().constraints, {});
  assert.deepEqual(demo.read().draft, []);
});
test("saved practical preferences preserve enrollment approval and reject stale additions", async () => {
  const demo = createStore(fresh()),
    enrollment = createEnrollment(demo, offline);
  assert.equal((await enrollment.choose("e1")).kind, "rsvp");
  assert.deepEqual(demo.read().plan, []);
  demo.update((s) => ({
    ...s,
    preferences: {
      ...defaultPreferences(),
      windows: [{ day: 0, start: 480, end: 540 }],
    },
  }));
  assert.equal(
    (await enrollment.confirm({ display_name: "Demo", attending: true })).kind,
    "rejected",
  );
  assert.deepEqual(demo.read().plan, []);
});

test("exploration is explicit and a newly stated topic overrides that search mode, not hard preferences", async () => {
  const { interpretRequest } =
    await import("../frontend/src/interpretation.ts");
  const s = {
    ...fresh(),
    interests: ["AI & education"],
    preferences: { ...defaultPreferences(), free_only: true },
  };
  const outside = recommend(s, { explore: true });
  assert.ok(outside.length);
  assert.ok(outside.every((e) => e.topic !== "AI & education" && e.cost === 0));
  const c = interpretRequest("AI events", { explore: true }).constraints;
  assert.equal(c.explore, undefined);
  assert.deepEqual(c.topics, ["AI & education"]);
  assert.ok(recommend(s, c).every((e) => e.cost === 0));
});

test("Show another excludes only for the current conversation without changing saved preferences", async () => {
  const demo = createStore(fresh()),
    before = structuredClone(demo.read().preferences);
  const conversation = createConversation(demo, () => {}, offline);
  await conversation.chat("AI events");
  const first = demo.read().draft[0];
  await conversation.another(first);
  assert.ok(!demo.read().draft.includes(first));
  assert.deepEqual(demo.read().preferences, before);
  assert.deepEqual(demo.read().plan, []);
  conversation.clear();
  await conversation.chat("AI events");
  assert.ok(demo.read().draft.includes(first));
});

test("actual plan requests exclude private notes/history and respect disabled topic inputs", async () => {
  const s = {
    ...fresh(),
    major: "PRIVATE_MAJOR",
    blocks: fresh().blocks.map((b) => ({ ...b, title: "PRIVATE_BUSY_TITLE" })),
    goals: "PRIVATE_RAW_GOAL",
    messages: [{ role: "user" as const, text: "PRIVATE_HISTORY" }],
    preferences: {
      ...defaultPreferences(),
      goals: ["career"],
      primary_goal: "career",
      learning_topics: [{ topic: "Career", source: "Added by you" as const }],
      why: "PRIVATE_REFLECTION",
      learning_note: "PRIVATE_LEARNING",
      next_note: "PRIVATE_NEXT",
      use_goals: false,
      use_learning: false,
    },
  };
  let body = "";
  await requestPlan("AI events", {}, s, async (_url, init) => {
    body = String(init?.body);
    return Response.json({
      mode: "simulated",
      understood: true,
      constraints: {},
      event_ids: [],
    });
  });
  const sent = JSON.parse(body);
  assert.equal(sent.message, "AI events");
  assert.equal("guidance" in sent.state.preferences, false);
  assert.deepEqual(sent.state.preferences.goal_topics, []);
  assert.deepEqual(sent.state.preferences.learning_topics, []);
  assert.equal("title" in sent.state.blocks[0], false);
  assert.deepEqual(sent.state.blocks[0], {
    day: s.blocks[0].day,
    start: s.blocks[0].start,
    end: s.blocks[0].end,
  });
  assert.ok(!body.includes("PRIVATE_"));
  assert.deepEqual(s.preferences.goals, ["career"]);
  assert.equal(s.preferences.learning_topics.length, 1);
});
