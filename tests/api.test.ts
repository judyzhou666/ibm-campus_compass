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
    Response.json({
      mode: "simulated",
      understood: true,
      constraints: {},
      event_ids: ["fake"],
    });
  const r = await requestPlan("AI", {}, fresh(), fake);
  assert.equal(r.source, "browser-fallback");
  assert.ok(!r.ids.includes("fake"));
});

test("invalid clock input is rejected before network or offline matching", async () => {
  for (const message of [
    "before 11:99 am",
    "after 99 pm",
    "after 13 pm",
    "before 0 am",
    "before 11:9",
    "after 1:999",
    "after 999999999999999999999999999999",
  ]) {
    let called = false;
    const fetcher: typeof fetch = async () => {
      called = true;
      throw new Error("offline");
    };
    await assert.rejects(
      requestPlan(message, {}, fresh(), fetcher),
      /Invalid day, time/,
    );
    assert.equal(called, false);
  }
});

test("invalid prior filters and oversized messages cannot bypass validation offline", async () => {
  for (const constraints of [
    { limit: 99 },
    { days: [9] },
    { after: -1 },
    { topics: ["invented"] },
  ]) {
    await assert.rejects(
      requestPlan("AI", constraints, fresh(), offline),
      /Invalid|Unknown/,
    );
  }
  await assert.rejects(
    requestPlan("AI" + "界".repeat(700), {}, fresh(), offline),
    /2000 bytes/,
  );
});

test("malformed server constraints use a validated labelled simulation", async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({
      mode: "simulated",
      understood: true,
      constraints: { after: -1 },
      event_ids: ["e1"],
    });
  const result = await requestPlan("AI", {}, fresh(), fetcher);
  assert.equal(result.source, "browser-fallback");
  assert.deepEqual(result.constraints, { topics: ["AI & education"] });
  assert.match(result.notice, /simulated demo planner/);
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
      understood: true,
      constraints: {},
      event_ids: ["e1"],
      recommendations: [evidence, { ...evidence, event_id: "fake" }],
    }),
  );
  assert.deepEqual(result.evidence, [evidence]);
});

test("numeric budgets are explicitly rejected before Rust or fallback can drop them", async () => {
  for (const message of [
    "arts on Wednesday evening under $5",
    "arts budget 5",
    "arts less than 5 dollars",
  ]) {
    let called = false;
    await assert.rejects(
      requestPlan(message, {}, fresh(), async () => {
        called = true;
        throw Error("offline");
      }),
      /Numeric budgets are not supported/,
    );
    assert.equal(called, false);
  }
  const r = await requestPlan(
    "arts on Wednesday evening free admission",
    {},
    fresh(),
    offline,
  );
  assert.deepEqual(r.ids, []);
  assert.equal(r.constraints.free, true);
});

test("result counts remain supported without bypassing numeric budget rejection", async () => {
  for (const [message, limit] of [
    ["career up to 3 events", 3],
    ["career at most 2 options", 2],
    ["career no more than 1 choices", 1],
  ] as const) {
    const result = await requestPlan(message, {}, fresh(), offline);
    assert.equal(result.constraints.limit, limit);
    assert.ok(result.ids.length > 0 && result.ids.length <= limit);
  }
  await assert.rejects(
    requestPlan("career up to 3 events under $5", {}, fresh(), offline),
    /Numeric budgets are not supported/,
  );
});

test("structured Rust match reasons are validated; legacy responses may omit them", async () => {
  const response = {
    mode: "simulated",
    understood: true,
    constraints: {},
    event_ids: ["e1"],
  };
  const old = await requestPlan("Find events", {}, fresh(), async () =>
    Response.json(response),
  );
  assert.equal(old.source, "rust");
  assert.deepEqual(old.matchReasons, []);
  for (const matchReasons of [
    [{ event_id: "fake", score: 1, matches: [] }],
    [{ event_id: "e1", score: 999, matches: [] }],
    [
      {
        event_id: "e1",
        score: 1,
        matches: [{ kind: "inferred-ability", points: 1, explanation: "bad" }],
      },
    ],
    [
      {
        event_id: "e1",
        score: 2,
        matches: [{ kind: "free", points: 2, explanation: "bad" }],
      },
    ],
    [
      {
        event_id: "e1",
        score: 2,
        matches: [
          { kind: "free", points: 1, explanation: "duplicate" },
          { kind: "free", points: 1, explanation: "duplicate" },
        ],
      },
    ],
  ]) {
    const result = await requestPlan("Find events", {}, fresh(), async () =>
      Response.json({ ...response, matchReasons }),
    );
    assert.equal(result.source, "browser-fallback");
    assert.deepEqual(result.evidence, []);
  }
});
