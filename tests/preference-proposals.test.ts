import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, createStore } from "../frontend/src/state.ts";
import {
  createPreferenceProposals,
  proposalChanges,
} from "../frontend/src/preferenceProposals.ts";
import {
  proposalTopic,
  defaultPreferences,
  clearPersonalization,
} from "../frontend/src/preferences.ts";
import { createConversation } from "../frontend/src/conversation.ts";
const offline: typeof fetch = async () => {
  throw Error("offline");
};
test("only recognized positive content maps; intent words and negated/unsupported subjects abstain", () => {
  assert.deepEqual(proposalTopic("I’m interested in UX research now."), [
    "AI & education",
  ]);
  assert.deepEqual(proposalTopic("I'm learning about Figma"), [
    "Arts & culture",
  ]);
  assert.deepEqual(proposalTopic("I'm learning about quantum gardening"), []);
  assert.deepEqual(proposalTopic("I'm not interested in UX research"), []);
  assert.deepEqual(
    proposalTopic("I'm interested in research but not career"),
    [],
  );
});
test("use once consumes only transient state and preserves saved topics and all hard requirements", async () => {
  const demo = createStore({
    ...fresh(),
    constraints: {
      after: 900,
      days: [1],
      free: true,
      mode: "discovery" as const,
    },
    preferences: {
      ...defaultPreferences(),
      free_only: true,
      windows: [{ day: 1, start: 900, end: 1020 }],
    },
  });
  const pending = createPreferenceProposals(demo),
    c = createConversation(demo, () => {}, offline);
  const before = structuredClone(demo.read()),
    p = pending.propose("I’m interested in UX research now.");
  assert.deepEqual(demo.read(), before);
  const once = pending.useOnce(p.id)!;
  assert.equal(pending.read(), null);
  assert.equal(pending.confirm(p.id), false);
  assert.equal(once.constraints.after, 900);
  assert.deepEqual(once.constraints.days, [1]);
  assert.equal(once.constraints.free, true);
  await c.chat(
    "Find events. " + once.text,
    once.constraints,
    once.constraints.topics,
  );
  assert.deepEqual(demo.read().preferences, before.preferences);
  assert.deepEqual(demo.read().plan, before.plan);
  assert.deepEqual(demo.read().interests, before.interests);
  assert.equal(demo.read().constraints.after, 900);
});
test("review discloses exact additions and enabling existing topics; confirm preserves provenance and unrelated data", () => {
  const demo = createStore({
    ...fresh(),
    plan: ["e1"],
    rsvps: ["e1"],
    constraints: { after: 900, days: [1], free: true },
    preferences: {
      ...defaultPreferences(),
      learning_topics: [{ topic: "Career", source: "Added by you" as const }],
      use_learning: false,
    },
  });
  const pending = createPreferenceProposals(demo),
    before = structuredClone(demo.read());
  const p = pending.propose("I'm interested in career and UX research");
  assert.deepEqual(proposalChanges(p, demo.read()), {
    additions: ["AI & education"],
    existing: ["Career"],
    enabledTopics: ["Career", "AI & education"],
    alreadyEnabled: false,
  });
  assert.deepEqual(demo.read(), before);
  assert.equal(pending.confirm(p.id), true);
  assert.deepEqual(demo.read().preferences?.learning_topics, [
    { topic: "Career", source: "Added by you" },
    { topic: "AI & education", source: "Confirmed from a conversation" },
  ]);
  assert.equal(demo.read().preferences?.use_learning, true);
  assert.deepEqual(demo.read().plan, before.plan);
  assert.deepEqual(demo.read().rsvps, before.rsvps);
  assert.deepEqual(demo.read().constraints, before.constraints);
  assert.equal(pending.confirm(p.id), false);
});
test("dismissed, superseded, deleted and reverted proposals can never be confirmed", () => {
  const demo = createStore(fresh()),
    pending = createPreferenceProposals(demo);
  const dismissed = pending.propose("I'm interested in UX research");
  pending.dismiss(dismissed.id);
  assert.equal(pending.confirm(dismissed.id), false);
  const old = pending.propose("I'm interested in career"),
    newer = pending.propose("I'm interested in UX research");
  assert.equal(pending.confirm(old.id), false);
  assert.equal(pending.read()?.id, newer.id);
  const before = structuredClone(demo.read());
  demo.update((s) => ({
    ...s,
    preferences: {
      ...defaultPreferences(),
      learning_note: "changed then removed",
    },
  }));
  demo.update(() => before);
  assert.equal(pending.useOnce(newer.id), null);
  assert.equal(pending.confirm(newer.id), false);
  const stale = pending.propose("I'm interested in career");
  demo.update(clearPersonalization);
  assert.equal(pending.confirm(stale.id), false);
  assert.deepEqual(demo.read().preferences?.learning_topics, []);
});
test("unsupported proposals expose no use-once or save operation", () => {
  const demo = createStore(fresh()),
    pending = createPreferenceProposals(demo),
    before = structuredClone(demo.read());
  const p = pending.propose("I'm learning about quantum gardening");
  assert.deepEqual(p.topics, []);
  assert.equal(pending.useOnce(p.id), null);
  assert.equal(pending.confirm(p.id), false);
  assert.deepEqual(demo.read(), before);
});
test("an obsolete use-once response cannot restore deleted preferences", async () => {
  const demo = createStore(fresh()),
    pending = createPreferenceProposals(demo);
  let finish!: (r: Response) => void;
  const c = createConversation(
    demo,
    () => {},
    async () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  const p = pending.propose("I'm interested in UX research"),
    once = pending.useOnce(p.id)!;
  const running = c.chat("Find events. " + once.text, once.constraints);
  demo.update(clearPersonalization);
  c.reset();
  const cleared = structuredClone(demo.read().preferences);
  finish(
    Response.json({
      mode: "simulated",
      understood: true,
      constraints: once.constraints,
      event_ids: ["e1"],
    }),
  );
  await running;
  assert.deepEqual(demo.read().preferences, cleared);
  assert.deepEqual(demo.read().draft, []);
  assert.equal(pending.confirm(p.id), false);
});

test("use once preserves exact mapped topics rather than reinterpreting intent words, online and offline", async () => {
  for (const online of [false, true]) {
    const demo = createStore(fresh()),
      pending = createPreferenceProposals(demo);
    let sent: { message: string; previous: { topics: string[] } } | undefined;
    const fetcher: typeof fetch = async (_url, init) => {
      if (!online) throw Error("offline");
      sent = JSON.parse(String(init?.body));
      return Response.json({
        mode: "simulated",
        understood: true,
        constraints: sent!.previous,
        event_ids: [],
      });
    };
    const c = createConversation(demo, () => {}, fetcher);
    const p = pending.propose("I'm learning about Figma"),
      once = pending.useOnce(p.id)!;
    await c.chat(
      "Find events. " + once.text,
      once.constraints,
      once.constraints.topics,
    );
    assert.deepEqual(demo.read().constraints.topics, ["Arts & culture"]);
    assert.deepEqual(demo.read().preferences?.learning_topics, []);
    if (online) {
      assert.equal(sent!.message, "Find events");
      assert.deepEqual(sent!.previous.topics, ["Arts & culture"]);
    }
  }
});

test("exact use-once topics cannot bypass numeric-budget rejection or AM/PM clarification", async () => {
  const demo = createStore(fresh());
  let requests = 0;
  const c = createConversation(
    demo,
    () => {},
    async () => {
      requests++;
      throw Error("offline");
    },
  );
  await c.chat("Find events. I'm learning about Figma under $5", {}, [
    "Arts & culture",
  ]);
  assert.match(
    demo.read().messages.at(-1)!.text,
    /Numeric budgets are not supported/,
  );
  assert.equal(requests, 0);
  await c.chat("Find events. I'm learning about Figma after 3", {}, [
    "Arts & culture",
  ]);
  assert.match(demo.read().messages.at(-1)!.text, /AM\/PM/);
  assert.equal(requests, 0);
  await c.chat("PM");
  assert.deepEqual(demo.read().constraints.topics, ["Arts & culture"]);
  assert.equal(demo.read().constraints.after, 900);
  assert.deepEqual(demo.read().preferences?.learning_topics, []);
  assert.deepEqual(demo.read().plan, []);
});
