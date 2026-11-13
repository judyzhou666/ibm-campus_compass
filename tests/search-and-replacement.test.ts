/**
 * Two bugs found by testing the site like a student and following
 * docs/demo-script.md:
 * 1. The header search needed the exact phrase ("career workshop" → 0 events).
 * 2. "Find a replacement" used the latest chat search instead of the search
 *    that found the cancelled event, so the scripted demo found nothing.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EVENTS } from "../frontend/src/data.ts";
import { matchesSearch } from "../frontend/src/filters.ts";
import { constraintSummary } from "../frontend/src/replanning.ts";
import { createConversation } from "../frontend/src/conversation.ts";
import { createEnrollment } from "../frontend/src/enrollment.ts";
import { createStore, fresh, restore } from "../frontend/src/state.ts";
import type { DemoState } from "../frontend/src/types.ts";

const titles = (q: string) =>
  EVENTS.filter((e) => matchesSearch(e, q)).map((e) => e.title);
const offline = async () => {
  throw Error("offline");
};
/** The same removal the app passes in (App.tsx). */
const remover =
  (demo: ReturnType<typeof createStore<DemoState>>) => (id: string) =>
    demo.update((s) => ({ ...s, plan: s.plan.filter((x) => x !== id) }));

describe("header search", () => {
  it("matches every word, in any order and field", () => {
    assert.deepEqual(titles("international students"), [
      "International tea table",
    ]);
    assert.ok(
      titles("career workshop").includes("Career storytelling workshop"),
    );
    assert.ok(
      titles("workshop career").includes("Career storytelling workshop"),
    );
    assert.ok(titles("AI lab").includes("Learning with AI: a hands-on lab"));
    assert.ok(titles("resume help").includes("Resume peer review"));
    assert.deepEqual(titles("wellbeing tuesday"), ["Student wellbeing circle"]);
  });

  it("free food covers every free food kind, like the Explore filter", () => {
    assert.equal(titles("free food").length, 21);
  });

  it("matches whole words only, with simple plurals", () => {
    const ai = EVENTS.filter((e) => matchesSearch(e, "AI"));
    assert.ok(ai.length > 0);
    for (const e of ai)
      assert.match(
        `${e.title} ${e.description} ${e.topic}`.toLowerCase(),
        /\bai\b|ai & education/,
        e.title,
      );
    assert.deepEqual(titles("workshops"), titles("workshop"));
  });

  it("an empty or filler-only query matches everything; nonsense matches nothing", () => {
    assert.equal(titles("events for students").length, EVENTS.length);
    assert.equal(titles("").length, EVENTS.length);
    assert.deepEqual(titles("purple giraffe"), []);
    assert.deepEqual(titles("a+b (c"), []);
  });
});

describe("replacement uses the search that found the cancelled event", () => {
  it("records the chat filters when a suggested event is added", async () => {
    const constraints = { topics: ["AI & education"], after: 780 };
    const demo = createStore<DemoState>({
      ...fresh(),
      draft: ["e31"],
      constraints,
    });
    await createEnrollment(demo, offline).choose("e31");
    assert.deepEqual(demo.read().plan, ["e31"]);
    assert.deepEqual(demo.read().planSources?.e31, constraints);
  });

  it("records {} for an event added outside the chat", async () => {
    const demo = createStore<DemoState>({
      ...fresh(),
      constraints: { topics: ["Career"], days: [1] },
    });
    await createEnrollment(demo, offline).choose("e31");
    assert.deepEqual(demo.read().planSources?.e31, {});
  });

  it("demo script: a later career search does not block the AI replacement", async () => {
    // AI ethics roundtable (e31, Mon) came from "AI career social … after 1 PM";
    // the latest search was "career on Tuesday afternoon".
    const demo = createStore<DemoState>({
      ...fresh(),
      plan: ["e31", "e7"],
      cancelled: ["e31"],
      planSources: {
        e31: {
          topics: ["AI & education", "Career", "Social"],
          after: 780,
          limit: 3,
        },
        e7: { topics: ["Career"], days: [1], after: 720, before: 1020 },
      },
      constraints: { topics: ["Career"], days: [1], after: 720, before: 1020 },
    });
    await createConversation(demo, remover(demo), offline).replace();
    const reply = demo.read().messages.at(-1)!.text;
    assert.match(reply, /AI ethics roundtable/);
    assert.match(reply, /An alternative is/, reply);
    assert.ok(!reply.includes("No replacement satisfies"), reply);
    assert.ok(!reply.includes("days: Tuesday"), reply);
    assert.match(
      reply,
      /kept all your other calendar choices: Designing your career story\./,
    );
  });

  it("older saved plans without sources still fall back to the latest search", async () => {
    const demo = createStore<DemoState>({
      ...fresh(),
      plan: ["e31"],
      cancelled: ["e31"],
      planSources: {},
      constraints: { topics: ["Career"], days: [1], after: 720, before: 1020 },
    });
    await createConversation(demo, remover(demo), offline).replace();
    // The latest search was career on Tuesday afternoon, so that is what is used.
    assert.match(
      demo.read().messages.at(-1)!.text,
      /An alternative is .* on Tue, Nov 3/,
    );
  });

  it("saved sources survive a reload; malformed ones are dropped", () => {
    const json = JSON.stringify({
      ...fresh(),
      planSources: {
        e31: { topics: ["AI & education"] },
        e7: { days: [9] },
        nope: {},
      },
    });
    const mock = {
      getItem: () => json,
      setItem: () => {},
      removeItem: () => {},
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: mock,
      configurable: true,
    });
    try {
      assert.deepEqual(restore().planSources, {
        e31: { topics: ["AI & education"] },
      });
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        value: undefined,
        configurable: true,
      });
    }
  });

  it("filter summaries use 12-hour times like the rest of the site", () => {
    assert.equal(
      constraintSummary({
        topics: ["Career"],
        days: [1],
        after: 720,
        before: 1020,
      }),
      "Career; days: Tuesday; start after 12 PM; finish before 5 PM",
    );
  });
});
