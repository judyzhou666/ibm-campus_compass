import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fresh, createStore, restore } from "../frontend/src/state.ts";
import { createConversation } from "../frontend/src/conversation.ts";
import {
  defaultPreferences,
  preferenceSettingsKey,
} from "../frontend/src/preferences.ts";
import {
  EventGuidance,
  RecommendationInfo,
  UsingPreferences,
} from "../frontend/src/RecommendationPresentation.tsx";
import { EVENTS } from "../frontend/src/data.ts";
import { rankingDetails } from "../frontend/src/planner.ts";
const offline: typeof fetch = async () => {
  throw Error("offline");
};

test("chat snapshots survive preference changes and refresh preserves history, plans and RSVP", async () => {
  const initial = {
    ...fresh(),
    plan: ["e1"],
    rsvps: ["e1"],
    preferences: defaultPreferences(),
  };
  const demo = createStore(initial),
    conversation = createConversation(demo, () => {}, offline);
  await conversation.chat("career events");
  const history = structuredClone(demo.read().messages);
  const old = history.at(-1)!;
  assert.equal(old.settingsKey, preferenceSettingsKey(initial));
  assert.ok(old.matchReasons?.length);
  demo.update((s) => ({
    ...s,
    interests: ["Social"],
    preferences: { ...defaultPreferences(), count: 1 },
    constraints: {},
    draft: [],
  }));
  conversation.reset();
  assert.deepEqual(demo.read().messages, history);
  assert.notEqual(old.settingsKey, preferenceSettingsKey(demo.read()));
  await conversation.refresh();
  assert.deepEqual(demo.read().messages.slice(0, history.length), history);
  assert.equal(
    demo.read().messages.at(-1)?.settingsKey,
    preferenceSettingsKey(demo.read()),
  );
  assert.equal(demo.read().draft.length, 1);
  assert.deepEqual(demo.read().plan, ["e1"]);
  assert.deepEqual(demo.read().rsvps, ["e1"]);
});

test("snapshot identity excludes raw notes and busy titles but tracks guidance and hard settings", () => {
  const a = { ...fresh(), preferences: defaultPreferences() };
  const b = structuredClone(a);
  b.preferences.why = "PRIVATE_REFLECTION";
  b.preferences.learning_note = "PRIVATE_LEARNING";
  b.major = "PRIVATE_MAJOR";
  b.blocks[0].title = "PRIVATE_TIMETABLE_TITLE";
  assert.equal(preferenceSettingsKey(a), preferenceSettingsKey(b));
  assert.ok(!preferenceSettingsKey(b).includes("PRIVATE_"));
  b.preferences.guidance = "steps";
  assert.notEqual(preferenceSettingsKey(a), preferenceSettingsKey(b));
  b.preferences = defaultPreferences();
  b.preferences.free_only = true;
  assert.notEqual(preferenceSettingsKey(a), preferenceSettingsKey(b));
});

test("stored chat snapshots restore bounded grounded reasons without reconstructing legacy reasons", async () => {
  const demo = createStore(fresh()),
    conversation = createConversation(demo, () => {}, offline);
  await conversation.chat("career events");
  const value = structuredClone(demo.read()),
    original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify(value) },
  });
  try {
    const stored = value.messages.at(-1)!;
    assert.deepEqual(
      restore().messages.at(-1)?.matchReasons,
      stored.matchReasons,
    );
    assert.equal(restore().messages.at(-1)?.settingsKey, stored.settingsKey);
    stored.matchReasons![0].score = 999;
    assert.deepEqual(restore().messages.at(-1)?.matchReasons, []);
    delete stored.settingsKey;
    assert.equal(restore().messages.at(-1)?.settingsKey, undefined);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("obsolete preference requests cannot append recommendations after reset", async () => {
  const demo = createStore(fresh());
  let finish!: (response: Response) => void;
  const conversation = createConversation(
    demo,
    () => {},
    async () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = conversation.chat("career events");
  demo.update((s) => ({
    ...s,
    preferences: { ...defaultPreferences(), free_only: true },
    draft: [],
    constraints: {},
  }));
  conversation.reset();
  const history = structuredClone(demo.read().messages);
  finish(
    Response.json({
      mode: "simulated",
      understood: true,
      constraints: {},
      event_ids: ["e20"],
    }),
  );
  await pending;
  assert.deepEqual(demo.read().messages, history);
  assert.deepEqual(demo.read().draft, []);
});

test("guidance renders selected depth and separates optional preparation from recorded facts", () => {
  const state = { ...fresh(), preferences: defaultPreferences() },
    event = EVENTS[0];
  const render = () =>
    renderToStaticMarkup(createElement(EventGuidance, { state, event }));
  assert.ok(render().length < 180);
  state.preferences.guidance = "first";
  assert.match(render(), /First step \(optional\)/);
  assert.ok(!render().includes("<ol>"));
  state.preferences.guidance = "steps";
  assert.equal((render().match(/<li>/g) || []).length, 3);
  assert.match(render(), /not official event requirements/);
  assert.match(render(), /RSVP required/);
  state.preferences.guidance = "information";
  assert.match(render(), /Unknowns:/);
  assert.match(render(), /Optional preparation:/);
  assert.match(render(), /fictional catalog/);
  assert.ok(!render().includes("Register at"));
});

test("historical cards use snapshot reasons and legacy cards abstain from current-fit claims", () => {
  const state = { ...fresh(), preferences: defaultPreferences() },
    event = EVENTS[0];
  const matches = rankingDetails(event, state).matches;
  state.interests = ["Career"];
  const historic = renderToStaticMarkup(
    createElement(RecommendationInfo, {
      state,
      event,
      matches,
      previousSettings: true,
    }),
  );
  assert.match(historic, /Why it was suggested/);
  assert.match(historic, /saved interests or enabled topics: AI/);
  const legacy = renderToStaticMarkup(
    createElement(RecommendationInfo, { state, event, previousSettings: true }),
  );
  assert.match(legacy, /Earlier matching details are unavailable/);
  const summary = renderToStaticMarkup(
    createElement(UsingPreferences, { state, onEdit: () => {} }),
  );
  assert.match(summary, /Using your preferences/);
  assert.match(summary, /Edit preferences/);
});
