import { test } from "node:test";
import assert from "node:assert/strict";
import {
  discoveryState,
  matchesDiscoveryFilter,
} from "../frontend/src/discovery.ts";
import { fresh, createStore } from "../frontend/src/state.ts";
import { requestPlan } from "../frontend/src/api.ts";
import { createConversation } from "../frontend/src/conversation.ts";
import { EVENTS } from "../frontend/src/data.ts";
const offline: typeof fetch = async () => {
  throw Error("offline");
};
test("Academic filtering happens before the saved count on fresh state", async () => {
  const state = fresh();
  const result = await requestPlan(
    "Find events",
    { mode: "discovery" },
    discoveryState(state, [], "Academic"),
    offline,
  );
  assert.deepEqual(result.ids.slice().sort(), ["e1", "e14", "e26"].sort());
  assert.ok(
    result.ids.every((id) =>
      matchesDiscoveryFilter(
        EVENTS.find((e) => e.id === id)!,
        "Academic",
      ),
    ),
  );
  assert.deepEqual(state.preferences!.dismissed, []);
});
test("transient exclusions preserve bookmarks and saved preferences", () => {
  const state = { ...fresh(), saved: ["e1"] };
  const overlay = discoveryState(state, ["e1"]);
  assert.ok(overlay.preferences!.dismissed.includes("e1"));
  assert.deepEqual(overlay.saved, ["e1"]);
  assert.deepEqual(state.preferences!.dismissed, []);
});
test("chat follow-ups retain skips until an explicit new search", async () => {
  const demo = createStore(fresh());
  const conversation = createConversation(demo, () => {}, offline);
  await conversation.chat("AI events on Tuesday after 1 PM");
  assert.ok(demo.read().draft.includes("e1"));
  await conversation.another("e1");
  await conversation.chat("after 2 PM");
  assert.ok(!demo.read().draft.includes("e1"));
  await conversation.chat("AI events on Tuesday after 1 PM", {});
  assert.ok(demo.read().draft.includes("e1"));
  assert.deepEqual(demo.read().preferences!.dismissed, []);
});
