/**
 * After a reload, AI Planner replies keep their evidence, alternatives and
 * example prompts. Before, only the text and main event IDs survived, so
 * Rust-planner answers were relabelled "Simulated browser suggestion" and the
 * "Also at the same time" cards vanished.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fresh, restore } from "../frontend/src/state.ts";
import type { Message } from "../frontend/src/types.ts";

const evidence = (event_id: string) => ({
  event_id,
  interest_match: "Matches AI & education",
  schedule_fit: "Fits Monday 3 PM with a 15-minute buffer",
  practical: "$0 admission · Drop-in welcome",
  trade_offs: "90 minutes",
  comparison: "Shorter than the alternative",
  cited_fields: ["topic", "food"],
});

function restored(messages: unknown[]) {
  const json = JSON.stringify({ ...fresh(), messages });
  const mock = { getItem: () => json, setItem: () => {}, removeItem: () => {} };
  Object.defineProperty(globalThis, "localStorage", {
    value: mock,
    configurable: true,
  });
  try {
    return restore().messages;
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
    });
  }
}

test("a Rust reply keeps its evidence, alternatives and examples after reload", () => {
  const reply: Message = {
    role: "assistant",
    text: "I found 3 options that fit together, plus 2 alternatives at the same time.",
    eventIds: ["e31", "e47", "e42"],
    overlapIds: ["e3", "e14"],
    altIds: ["e18"],
    examples: ["Career events on Wednesday"],
    evidence: [evidence("e31"), evidence("e47"), evidence("e42")],
  };
  const [m] = restored([reply]);
  assert.deepEqual(m, reply);
});

test("malformed or unrelated saved data is dropped, the rest is kept", () => {
  const [m] = restored([
    {
      role: "assistant",
      text: "Picks",
      eventIds: ["e31", "nope"],
      overlapIds: ["e3", 7, "bad"],
      altIds: "e18",
      examples: ["ok", 5, "x".repeat(500)],
      evidence: [
        evidence("e31"),
        evidence("e47"), // not one of this message's picks
        { event_id: "e31" }, // missing fields
        "junk",
        { ...evidence("e31"), cited_fields: ["topic", 3] },
      ],
    },
  ]);
  assert.deepEqual(m.eventIds, ["e31"]);
  assert.deepEqual(m.overlapIds, ["e3"]);
  assert.equal(m.altIds, undefined);
  assert.deepEqual(m.examples, ["ok"]);
  assert.equal(m.evidence?.length, 2);
  assert.ok(m.evidence?.every((e) => e.event_id === "e31"));
  assert.deepEqual(m.evidence?.[1].cited_fields, ["topic"]);
});

test("plain user messages are unchanged", () => {
  const [m] = restored([{ role: "user", text: "AI events" }]);
  assert.deepEqual(m, { role: "user", text: "AI events", eventIds: [] });
});
