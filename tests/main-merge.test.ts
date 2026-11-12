import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  restore,
  STORAGE_KEY,
  createStore,
} from "../frontend/src/state.ts";
import {
  profilePayload,
  requestPlan,
  planningKey,
  recommendationPreferenceKey,
} from "../frontend/src/api.ts";
import { createConversation } from "../frontend/src/conversation.ts";
import {
  defaultPreferences,
  clearPersonalization,
  preferenceSettingsKey,
} from "../frontend/src/preferences.ts";
import { homeRecommendations } from "../frontend/src/home.ts";
import { issue } from "../frontend/src/planner.ts";
import { EVENTS } from "../frontend/src/data.ts";
const offline: typeof fetch = async () => {
  throw Error("offline");
};

test("profile ranking consent defaults off, transmits only named fields after opt-in, and revokes", async () => {
  const s = {
    ...fresh(),
    major: "Education",
    goals: "Research in learning",
    goal_types: ["research"],
    preferences: {
      ...defaultPreferences(),
      why: "PRIVATE_REFLECTION",
      learning_note: "PRIVATE_LEARNING",
    },
  };
  assert.deepEqual(profilePayload(s), { major: "", goals: "", goal_types: [] });
  let sent: any;
  const capture: typeof fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    throw Error("offline");
  };
  await requestPlan("Career events", {}, s, capture);
  assert.deepEqual(sent.profile, { major: "", goals: "", goal_types: [] });
  const approved = { ...s, profileRankingConsent: true };
  await requestPlan("Career events", {}, approved, capture);
  assert.deepEqual(sent.profile, {
    major: s.major,
    goals: s.goals,
    goal_types: s.goal_types,
  });
  assert.ok(!JSON.stringify(sent).includes("PRIVATE_"));
  assert.ok(sent.state.blocks.every((b: any) => !("title" in b)));
  assert.notEqual(planningKey(s), planningKey(approved));
  assert.notEqual(
    recommendationPreferenceKey(s),
    recommendationPreferenceKey(approved),
  );
  assert.notEqual(preferenceSettingsKey(s), preferenceSettingsKey(approved));
  const cleared = clearPersonalization(approved);
  assert.equal(cleared.profileRankingConsent, false);
  assert.deepEqual(cleared.goal_types, []);
  assert.deepEqual(profilePayload(cleared), {
    major: "",
    goals: "",
    goal_types: [],
  });
});

test("legacy storage retains profile/preferences/plans/chat without inventing profile consent", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const saved = {
    ...fresh(),
    major: "Saved major",
    goals: "Saved goals",
    goal_types: ["research"],
    plan: ["e1"],
    rsvps: ["e1"],
    messages: [
      {
        role: "assistant",
        text: "Prior suggestions",
        eventIds: ["e1"],
        overlapIds: ["e17"],
        altIds: ["e20"],
        examples: ["Career events"],
        resolvedConstraints: {
          topics: ["AI & education"],
          after: 900,
          mode: "discovery",
        },
      },
    ],
  };
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) =>
          key === STORAGE_KEY ? JSON.stringify(saved) : null,
      },
    });
    const loaded = restore();
    assert.equal(loaded.major, saved.major);
    assert.equal(loaded.goals, saved.goals);
    assert.equal(loaded.profileRankingConsent, false);
    assert.deepEqual(loaded.goal_types, ["research"]);
    assert.deepEqual(loaded.plan, ["e1"]);
    assert.deepEqual(loaded.rsvps, ["e1"]);
    assert.deepEqual(loaded.messages[0].overlapIds, ["e17"]);
    assert.deepEqual(loaded.messages[0].altIds, ["e20"]);
    assert.deepEqual(
      loaded.messages[0].resolvedConstraints,
      saved.messages[0].resolvedConstraints,
    );
    assert.deepEqual(loaded.preferences, defaultPreferences());
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("configured watsonx forwards unsupported wording and preserves model attribution/evidence", async () => {
  let calls = 0;
  const remote: typeof fetch = async () => {
    calls++;
    return new Response(
      JSON.stringify({
        mode: "watsonx",
        explanations: "watsonx",
        understood: true,
        provider: "mock",
        constraints: { topics: ["Career"], limit: 1 },
        event_ids: ["e7"],
        recommendations: [
          {
            event_id: "e7",
            interest_match: "Career",
            schedule_fit: "No conflict",
            practical: "Unknown access conditions",
            trade_offs: "Compare records",
            ai_reason: "A career discussion; access not confirmed.",
            cited_fields: ["title", "goal_type"],
          },
        ],
      }),
      { status: 200 },
    );
  };
  const r = await requestPlan(
    "surprise me with an unusual opportunity",
    {},
    fresh(),
    remote,
    undefined,
    false,
    true,
  );
  assert.equal(calls, 1);
  assert.equal(r.mode, "watsonx");
  assert.equal(r.explanations, "watsonx");
  assert.equal(
    r.evidence[0].ai_reason,
    "A career discussion; access not confirmed.",
  );
  assert.deepEqual(r.evidence[0].cited_fields, ["title", "goal_type"]);
});

test("main fresh-search behavior coexists with clock follow-ups, refresh and session skips", async () => {
  const store = createStore(fresh()),
    c = createConversation(store, () => {}, offline);
  await c.chat("AI on Tuesday after 1 PM");
  await c.another("e1");
  await c.chat("after 2 PM");
  assert.deepEqual(store.read().constraints.topics, ["AI & education"]);
  assert.deepEqual(store.read().constraints.days, [1]);
  assert.ok(!store.read().draft.includes("e1"));
  assert.ok(!store.read().messages.at(-1)?.overlapIds?.includes("e1"));
  await c.chat("Social events with free food");
  assert.equal(store.read().constraints.food, "Free meal");
  await c.chat("Career on Wednesday evening");
  assert.equal(store.read().constraints.food, undefined);
  assert.deepEqual(store.read().constraints.topics, ["Career"]);
  const message = structuredClone(store.read().messages.at(-1)!);
  await c.removeFilter("Wednesday", {
    topics: ["Career"],
    after: 1020,
    mode: "plan-building",
  });
  assert.match(store.read().messages.at(-1)!.text, /Removed Wednesday/);
  await c.refresh(undefined, message);
  assert.deepEqual(store.read().constraints.days, [2]);
});

test("Home retains main profile ranking and incorporates enabled Doris preferences and count", () => {
  const s = {
    ...fresh(),
    onboarded: true,
    preferencesConfigured: true,
    interests: [],
    major: "Engineering",
    goal_types: ["research"],
    preferences: {
      ...defaultPreferences(),
      count: 1 as const,
      use_learning: true,
      learning_topics: [{ topic: "Career", source: "Added by you" as const }],
    },
  };
  const recs = homeRecommendations(s);
  assert.equal(recs.personalized, true);
  assert.equal(recs.events.length, 1);
  assert.equal(recs.events[0].topic, "Career");
  s.preferences.dismissed = [recs.events[0].id];
  assert.notEqual(homeRecommendations(s).events[0].id, recs.events[0].id);
  assert.ok(homeRecommendations(s).events.every((e) => !issue(e, s)));
  const e6 = EVENTS.find((e) => e.id === "e6")!;
  assert.equal(issue(e6, { ...s, appliedUpdateIds: ["u2"] }), "Event is full");
});
