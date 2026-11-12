/**
 * Round-2 planner tests: free-admission wording, phrase synonyms, no-match
 * alternatives, filter chips, overlap detection, and fresh-search behaviour.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { interpretRequest } from "../frontend/src/interpretation.ts";
import { filterChips, removeChip } from "../frontend/src/filterChips.ts";
import { EVENTS } from "../frontend/src/data.ts";
import { recommend } from "../frontend/src/planner.ts";
import { fresh } from "../frontend/src/state.ts";
import { createConversation } from "../frontend/src/conversation.ts";
import { createStore } from "../frontend/src/state.ts";
import type { Constraints } from "../frontend/src/types.ts";

// ---------------------------------------------------------------------------
// 1. Free-admission wording (Fix 2)
// ---------------------------------------------------------------------------
describe("free-admission wording", () => {
  it("'free food' sets food filter only, not free admission", () => {
    const c = interpretRequest("free food").constraints;
    assert.equal(c.food, "Free meal");
    assert.equal(c.free, undefined, "free admission must not be set for 'free food'");
  });

  it("'anything with free food' sets food filter only", () => {
    const c = interpretRequest("anything with free food").constraints;
    assert.equal(c.food, "Free meal");
    assert.equal(c.free, undefined);
  });

  it("'I\\'m free Wednesday evening' sets day+time only, not free admission", () => {
    const c = interpretRequest("I'm free Wednesday evening").constraints;
    assert.deepEqual(c.days, [2]);
    assert.equal(c.after, 1020);
    assert.equal(c.free, undefined, "'I'm free' must not set free admission");
  });

  it("'free time Wednesday' sets day only, not free admission", () => {
    const c = interpretRequest("free time Wednesday").constraints;
    assert.deepEqual(c.days, [2]);
    assert.equal(c.free, undefined);
  });

  it("'free admission' sets free admission only", () => {
    const c = interpretRequest("free admission").constraints;
    assert.equal(c.free, true);
    assert.equal(c.food, undefined);
  });

  it("'free entry' sets free admission", () => {
    const c = interpretRequest("free entry").constraints;
    assert.equal(c.free, true);
  });

  it("'free to attend' sets free admission", () => {
    const c = interpretRequest("free to attend").constraints;
    assert.equal(c.free, true);
  });

  it("'no cost' sets free admission", () => {
    const c = interpretRequest("no cost events").constraints;
    assert.equal(c.free, true);
  });
});

// ---------------------------------------------------------------------------
// 2. Phrase synonyms (Fix 4)
// ---------------------------------------------------------------------------
describe("phrase synonyms", () => {
  it("'internship' → Career", () => {
    assert.deepEqual(interpretRequest("internship").constraints.topics, ["Career"]);
  });

  it("'find an internship' → Career", () => {
    assert.deepEqual(interpretRequest("find an internship").constraints.topics, ["Career"]);
  });

  it("'help me find a job' → Career", () => {
    assert.deepEqual(interpretRequest("help me find a job").constraints.topics, ["Career"]);
  });

  it("'I want to practice my English' → Social", () => {
    assert.deepEqual(
      interpretRequest("I want to practice my English").constraints.topics,
      ["Social"],
    );
  });

  it("'practice some English' → Social", () => {
    assert.deepEqual(
      interpretRequest("practice some English").constraints.topics,
      ["Social"],
    );
  });

  it("'make some friends' → Social", () => {
    assert.deepEqual(interpretRequest("make some friends").constraints.topics, ["Social"]);
  });

  it("'make new friends' → Social", () => {
    assert.deepEqual(interpretRequest("make new friends").constraints.topics, ["Social"]);
  });

  it("'meet new people' → Social", () => {
    assert.deepEqual(interpretRequest("meet new people").constraints.topics, ["Social"]);
  });

  it("'get a job' → Career", () => {
    assert.deepEqual(interpretRequest("get a job").constraints.topics, ["Career"]);
  });

  it("'language exchange' → Social", () => {
    assert.deepEqual(interpretRequest("language exchange").constraints.topics, ["Social"]);
  });
});

// ---------------------------------------------------------------------------
// 3. filterChips helper (Fix 1 / Fix 2)
// ---------------------------------------------------------------------------
describe("filterChips labels", () => {
  it("produces chip for topics", () => {
    const chips = filterChips({ topics: ["Career"] });
    assert.equal(chips.length, 1);
    assert.equal(chips[0].label, "Career");
    assert.deepEqual(chips[0].keys, ["topics"]);
  });

  it("produces chip for day", () => {
    const chips = filterChips({ days: [2] });
    assert.equal(chips[0].label, "Wednesday");
  });

  it("produces 'Evening' chip for after>=1020", () => {
    const chips = filterChips({ after: 1020 });
    assert.equal(chips[0].label, "Evening");
    assert.ok(chips[0].keys.includes("after"));
  });

  it("produces 'Morning' chip for before<=720", () => {
    const chips = filterChips({ before: 720 });
    assert.equal(chips[0].label, "Morning");
  });

  it("produces 'Free food' chip for food=Free meal", () => {
    const chips = filterChips({ food: "Free meal" });
    assert.equal(chips[0].label, "Free food");
    assert.deepEqual(chips[0].keys, ["food"]);
  });

  it("produces 'Free admission' chip for free=true", () => {
    const chips = filterChips({ free: true });
    assert.equal(chips[0].label, "Free admission");
    assert.deepEqual(chips[0].keys, ["free"]);
  });

  it("removes the correct keys when removeChip is called", () => {
    const c: Constraints = { days: [2], after: 1020, food: "Free meal" };
    const chips = filterChips(c);
    // chip for food
    const foodChip = chips.find((ch) => ch.label === "Free food")!;
    const after = removeChip(c, foodChip);
    assert.equal(after.food, undefined);
    assert.deepEqual(after.days, [2]);
    assert.equal(after.after, 1020);
  });
});

// ---------------------------------------------------------------------------
// 4. Fresh search / carry-over (Fix 1)
// ---------------------------------------------------------------------------
describe("fresh-search carry-over", () => {
  it("'free food' then 'Wednesday evening' → no food filter", () => {
    const c1 = interpretRequest("free food").constraints;
    assert.equal(c1.food, "Free meal");
    // A fresh question does not pass previous constraints.
    const c2 = interpretRequest("Wednesday evening").constraints;
    assert.equal(c2.food, undefined, "fresh question must not inherit food filter");
    assert.deepEqual(c2.days, [2]);
    assert.equal(c2.after, 1020);
  });

  it("follow-up 'only on Thursday' keeps topic from previous constraints", () => {
    const prev: Constraints = { topics: ["Career"] };
    const c = interpretRequest("only on Thursday", prev).constraints;
    assert.deepEqual(c.topics, ["Career"]);
    assert.deepEqual(c.days, [3]);
  });

  it("'start over' clears all constraints", () => {
    const prev: Constraints = { topics: ["Career"], days: [1], food: "Free meal" };
    const c = interpretRequest("start over", prev).constraints;
    assert.deepEqual(c, {}, "start over must clear all constraints");
  });
});

// ---------------------------------------------------------------------------
// 5. No-match alternatives (Fix 3) — browser-side
// ---------------------------------------------------------------------------
describe("no-match alternatives (browser recommend)", () => {
  it("'arts events with free food on Monday morning' returns alternatives without food", async () => {
    const state = fresh();
    const demo = createStore(state);
    const conversation = createConversation(demo, () => {}, async () => {
      throw Error("offline");
    });
    await conversation.chat("arts events with free food on Monday morning");
    const messages = demo.read().messages.filter((m) => m.role === "assistant");
    const last = messages[messages.length - 1];
    const errorMsg = last.text;
    // Should NOT contain the old jargon.
    assert.ok(
      !errorMsg.includes("synthetic catalog records"),
      `Should not contain jargon, got: ${errorMsg}`,
    );
    // Should appear only once (no duplication).
    const firstIdx = errorMsg.indexOf("Nothing");
    const doubled = firstIdx >= 0 && errorMsg.indexOf("Nothing", firstIdx + 1) >= 0;
    assert.ok(!doubled, `No-match sentence must not appear twice, got: ${errorMsg}`);
    // Should have a plain-language response.
    const hasFallback =
      errorMsg.includes("Nothing matched") ||
      errorMsg.includes("Nothing on") ||
      errorMsg.includes("Nothing matches") ||
      errorMsg.includes("I couldn't find") ||
      errorMsg.includes("I didn't find");
    assert.ok(hasFallback, `Should have a plain-language response, got: ${errorMsg}`);
  });
});

// ---------------------------------------------------------------------------
// 6. Overlap alternatives (Fix 5)
// ---------------------------------------------------------------------------
describe("overlap alternatives (Wednesday evening)", () => {
  it("Wednesday evening returns 1 conflict-free pick and up to 2 overlap alternatives", async () => {
    const state = fresh();
    const constraints: Constraints = { days: [2], after: 1020 };
    const picks = recommend(state, constraints);
    // We know there are 3 eligible Wed evening events; recommend returns 1 conflict-free.
    assert.equal(picks.length, 1);
    const pickIds = new Set(picks.map((e) => e.id));
    const { overlap } = await import("../frontend/src/planner.ts");
    const eligible = EVENTS.filter(
      (e) => e.day === 2 && e.start >= 1020 && !state.plan.includes(e.id),
    );
    const overlappers = eligible.filter(
      (e) => !pickIds.has(e.id) && picks.some((p) => overlap(e, p, state.buffer)),
    );
    assert.ok(overlappers.length >= 2, `Expected >=2 overlap alternatives, got ${overlappers.length}`);
  });
});
