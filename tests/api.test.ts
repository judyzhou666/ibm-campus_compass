import { test } from "node:test";
import assert from "node:assert/strict";
import {
  requestPlan,
  enrollEvent,
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

test("required RSVP cannot be bypassed, even offline", async () => {
  for (const rsvp of [
    undefined,
    { display_name: "Judy", attending: false },
    { display_name: "   ", attending: true },
    { display_name: "a".repeat(121), attending: true },
  ]) {
    await assert.rejects(
      enrollEvent("e1", fresh(), rsvp, offline),
      /required RSVP/,
    );
  }
});
test("demo enrollment supports completed RSVP and drop-in, with explicit offline notice", async () => {
  const rsvp = await enrollEvent(
    "e1",
    fresh(),
    { display_name: "Judy", attending: true },
    offline,
  );
  assert.equal(rsvp.rsvpConfirmed, true);
  assert.match(rsvp.notice, /locally/);
  const dropin = await enrollEvent("e5", fresh(), undefined, offline);
  assert.equal(dropin.rsvpConfirmed, false);
});
test("enrollment checks cancellations and access and respects server rejections", async () => {
  const confirmed = { display_name: "Judy", attending: true };
  await assert.rejects(
    enrollEvent("e1", { ...fresh(), cancelled: ["e1"] }, confirmed, offline),
    /Cancelled/,
  );
  await assert.rejects(
    enrollEvent("e12", fresh(), confirmed, offline),
    /Membership/,
  );
  for (const status of [400, 401, 403, 409, 422]) {
    const rejected: typeof fetch = async () => new Response("{}", { status });
    await assert.rejects(
      enrollEvent("e1", fresh(), confirmed, rejected),
      /could not accept/,
    );
  }
});
test("enrollment sends only the selected RSVP and schedule, and accepts a verified demo response", async () => {
  const fetcher: typeof fetch = async (path, options) => {
    assert.equal(path, "/api/enroll");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.rsvp.display_name, "Demo student");
    assert.equal("messages" in body.state, false);
    return Response.json({
      event_id: "e1",
      demo: true,
      status: "enrolled",
      rsvp_confirmed: true,
    });
  };
  assert.equal(
    (
      await enrollEvent(
        "e1",
        fresh(),
        { display_name: "Demo student", attending: true },
        fetcher,
      )
    ).notice,
    "",
  );
});

test("offline planning supplies no invented Rust recommendation evidence", async () => {
  const result = await requestPlan("AI", {}, fresh(), offline);
  assert.deepEqual(result.evidence, []);
  assert.equal(result.source, "browser-fallback");
});

test("Rust recommendation evidence is retained only for selected event IDs", async () => {
  const evidence = {
    event_id: "e1",
    interest_match: "AI",
    schedule_fit: "Tuesday",
    practical: "RSVP required",
    trade_offs: "Fictional record",
  };
  const result = await requestPlan("AI", {}, fresh(), async () =>
    Response.json({
      mode: "simulated",
      constraints: {},
      event_ids: ["e1"],
      recommendations: [evidence, { ...evidence, event_id: "fake" }],
    }),
  );
  assert.deepEqual(result.evidence, [evidence]);
});
