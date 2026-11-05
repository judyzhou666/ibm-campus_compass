import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretRequest } from "../frontend/src/interpretation.ts";
import { createStore, fresh } from "../frontend/src/state.ts";
import { createConversation } from "../frontend/src/conversation.ts";
const offline: typeof fetch = async () => {
  throw Error("offline");
};
test("temporary beyond-interest exploration ends with the next ordinary search", async () => {
  const demo = createStore(fresh()),
    c = createConversation(demo, () => {}, offline);
  await c.chat("Explore beyond my interests", {
    explore: true,
    mode: "discovery",
  });
  assert.equal(demo.read().constraints.explore, true);
  const original = structuredClone(demo.read().messages.at(-1)!);
  await c.chat("Tuesday afternoon events");
  assert.equal(demo.read().constraints.explore, undefined);
  assert.notEqual(demo.read().constraints.mode, "discovery");
  assert.ok(demo.read().draft.includes("e1"));
  await c.refresh(undefined, original);
  assert.equal(demo.read().constraints.explore, true);
  assert.equal(demo.read().constraints.mode, "discovery");
});
test("reset clears temporary mode/exploration but explicit discovery remains available", () => {
  const previous = { explore: true, mode: "discovery" as const, after: 900 };
  assert.deepEqual(interpretRequest("start over", previous).constraints, {});
  assert.deepEqual(interpretRequest("reset", previous).constraints, {});
  assert.equal(
    interpretRequest("Explore beyond my interests", previous).constraints
      .explore,
    true,
  );
  assert.equal(
    interpretRequest("Discover events", previous).constraints.mode,
    "discovery",
  );
  assert.equal(
    interpretRequest("Discover events", previous).constraints.explore,
    undefined,
  );
});
