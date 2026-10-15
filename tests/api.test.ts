import { test } from "node:test";
import assert from "node:assert/strict";
import {
  requestPlan,
  validateEvent,
  schedulePayload,
} from "../frontend/src/api.ts";
import { fresh } from "../frontend/src/state.ts";
import { calendarText } from "../frontend/src/calendar.ts";
const offline: typeof fetch = async () => {
  throw new Error("offline");
};
test("offline mode is explicit and respects constraints", async () => {
  const r = await requestPlan(
    "AI on Tuesday or Thursday afternoons",
    {},
    fresh(),
    offline,
  );
  assert.equal(r.source, "browser-fallback");
  assert.match(r.notice, /unavailable/);
  assert.deepEqual(r.ids, ["e1", "e5"]);
});
test("server input rejection is surfaced, not bypassed", async () => {
  const bad: typeof fetch = async () => new Response("{}", { status: 400 });
  await assert.rejects(requestPlan("AI", {}, fresh(), bad), /could not accept/);
  await assert.rejects(validateEvent("e1", fresh(), bad), /could not accept/);
});
test("unknown model event IDs cannot enter a draft", async () => {
  const fake: typeof fetch = async () =>
    Response.json({ mode: "simulated", constraints: {}, event_ids: ["fake"] });
  const r = await requestPlan("AI", {}, fresh(), fake);
  assert.equal(r.source, "browser-fallback");
  assert.ok(!r.ids.includes("fake"));
});
test("payload omits history; offline validation checks access", async () => {
  const state = fresh();
  state.messages = [{ role: "user", text: "history" }];
  assert.equal("messages" in schedulePayload(state), false);
  assert.equal("name" in schedulePayload(state), false);
  assert.match(
    (await validateEvent("e12", state, offline)).issue!,
    /Membership/,
  );
});
test("calendar export labels demo records and excludes cancellations", () => {
  const text = calendarText({
    ...fresh(),
    plan: ["e1", "e5"],
    cancelled: ["e1"],
  })!;
  assert.ok(!text.includes("UID:e1-"));
  assert.ok(text.includes("UID:e5-"));
  assert.ok(text.includes("[DEMO]"));
  assert.ok(text.includes("DTSTART:20261022T190000Z"));
});
