import { interpretRequest } from "../frontend/src/interpretation.ts";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { EVENTS } from "../frontend/src/data.ts";
import { fresh } from "../frontend/src/state.ts";
import { recommend, issue } from "../frontend/src/planner.ts";
import { schedulePayload } from "../frontend/src/api.ts";
import type { Constraints } from "../frontend/src/types.ts";
const server = spawn(
  process.env.CAMPUS_BINARY || "target/debug/campus-compass",
  [],
  {
    env: {
      ...process.env,
      CAMPUS_ADDR: "127.0.0.1:0",
      PLANNER_PROVIDER: "simulated",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
server.stderr.on("data", (data) => process.stderr.write(data));
const base = await new Promise<string>((resolve, reject) => {
  const timeout = setTimeout(() => {
    server.kill();
    reject(new Error("Server did not start"));
  }, 15000);
  server.on("error", (e) => {
    clearTimeout(timeout);
    reject(e);
  });
  server.on("exit", (code) => {
    clearTimeout(timeout);
    reject(new Error(`Server exited ${code}`));
  });
  server.stdout.on("data", (data) => {
    output += data;
    const m = output.match(/http:\/\/127\.0\.0\.1:\d+/);
    if (m) {
      clearTimeout(timeout);
      resolve(m[0]);
    }
  });
});
async function post(path: string, body: unknown) {
  return fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
try {
  const health = await (await fetch(base + "/api/health")).json();
  assert.equal(health.watsonx_connected, false);
  const state = fresh();
  for (const query of [
    "AI and education on Tuesday or Thursday afternoons",
    "social with free food",
    "career after 1 PM",
    "arts on Wednesday",
    "weekend events",
    "before 8 AM",
    "no AI events",
    "coffee on Thursday",
    "AI morning",
    "3 events",
    "start over",
    "wellbeing weekdays",
    "professional",
    "ceramics",
    "balance",
    "snack",
    "refreshment",
    "any day",
    "any time",
    "options",
    "purple flying giraffes",
    "before 12 am",
    "after 12 pm",
    "after 23:59",
  ]) {
    const response = await post("/api/plan", {
      message: query,
      previous: {},
      state: schedulePayload(state),
    });
    assert.equal(response.status, 200);
    const result = await response.json(),
      interpreted = interpretRequest(query),
      c = interpreted.constraints;
    assert.equal(result.understood, interpreted.understood, query);
    assert.deepEqual(result.constraints, c, query);
    assert.equal(result.recommendations.length, result.event_ids.length);
    for (const evidence of result.recommendations) {
      const event = EVENTS.find((e) => e.id === evidence.event_id)!;
      assert.ok(result.event_ids.includes(event.id));
      assert.match(
        evidence.interest_match,
        new RegExp(event.topic.replace(/[&]/g, "[&]")),
      );
      assert.ok(evidence.practical.includes(event.location));
      assert.ok(evidence.practical.includes(event.rsvp));
      assert.match(evidence.trade_offs, /not externally verified/);
      assert.match(evidence.schedule_fit, /no current conflicts/);
    }

    assert.deepEqual(
      result.event_ids,
      interpreted.understood ? recommend(state, c).map((e) => e.id) : [],
      query,
    );
  }

  assert.deepEqual(
    await (await fetch(base + "/api/config")).json(),
    (await import("../frontend/src/config.ts")).DEMO,
  );
  for (const message of [
    "events near me",
    "social but not Tuesday",
    "career after 3",
  ]) {
    const r = await (
      await post("/api/plan", { message, state: schedulePayload(state) })
    ).json();
    assert.equal(r.event_ids.length, 0);
    assert.equal(r.clarification, interpretRequest(message).clarification);
  }
  const impossible = await (
    await post("/api/plan", {
      message: "AI on Tuesday morning",
      state: schedulePayload(state),
    })
  ).json();
  assert.match(impossible.diagnostic, /scheduling conflicts/);
  const diverse = await (
    await post("/api/plan", {
      message: "AI career social events",
      state: schedulePayload(state),
    })
  ).json();
  assert.equal(
    new Set(
      diverse.event_ids.map(
        (id: string) => EVENTS.find((e) => e.id === id)!.topic,
      ),
    ).size,
    3,
  );
  for (const e of diverse.recommendations) {
    assert.ok(e.comparison);
    assert.match(e.comparison, /Major and free-text/);
    assert.ok(e.constraints_satisfied);
  }
  const previous: Constraints = {
    days: [1],
    food: "Free meal",
    topics: ["Social"],
  };
  const followup = await (
    await post("/api/plan", {
      message: "no food preference",
      previous,
      state: schedulePayload(state),
    })
  ).json();
  assert.deepEqual(
    followup.constraints,
    interpretRequest("no food preference", previous).constraints,
  );
  for (const event of EVENTS) {
    const r = await (
      await post("/api/validate", {
        event_id: event.id,
        state: schedulePayload(state),
      })
    ).json();
    assert.equal(r.issue, issue(event, state));
  }
  const confirmed = { display_name: "Demo student", attending: true };
  for (const rsvp of [
    undefined,
    { display_name: "Judy", attending: false },
    { display_name: " ", attending: true },
  ]) {
    assert.equal(
      (
        await post("/api/enroll", {
          event_id: "e1",
          state: schedulePayload(state),
          rsvp,
        })
      ).status,
      422,
    );
  }
  for (const event of EVENTS) {
    const response = await post("/api/enroll", {
      event_id: event.id,
      state: schedulePayload(state),
      rsvp: confirmed,
    });
    assert.equal(response.status, issue(event, state) ? 409 : 200, event.title);
  }
  const enrolled = await (
    await post("/api/enroll", {
      event_id: "e1",
      state: schedulePayload(state),
      rsvp: confirmed,
    })
  ).json();
  assert.deepEqual(enrolled, {
    event_id: "e1",
    demo: true,
    status: "enrolled",
    rsvp_confirmed: true,
  });
  assert.equal(
    (
      await post("/api/enroll", {
        event_id: "e5",
        state: schedulePayload(state),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post("/api/enroll", {
        event_id: "e1",
        state: schedulePayload({ ...state, cancelled: ["e1"] }),
        rsvp: confirmed,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post("/api/enroll", {
        event_id: "fake",
        state: schedulePayload(state),
        rsvp: confirmed,
      })
    ).status,
    400,
  );
  const booked = { ...state, plan: ["e1"], cancelled: ["e5"] };
  const result = await (
    await post("/api/plan", {
      message: "AI",
      previous: {},
      state: schedulePayload(booked),
    })
  ).json();
  assert.ok(!result.event_ids.includes("e1"));
  assert.ok(!result.event_ids.includes("e5"));
  for (const body of [
    { message: "AI", state: { ...schedulePayload(state), plan: ["fake"] } },
    { message: "AI", state: { ...schedulePayload(state), buffer: -1 } },
    {
      message: "AI",
      state: {
        ...schedulePayload(state),
        blocks: [{ title: "bad", day: 0, start: 700, end: 600 }],
      },
    },
    { message: "AI", state: schedulePayload(state), previous: { limit: 100 } },
    { message: "after 99 pm", state: schedulePayload(state) },
    ...[
      "before 11:99 am",
      "after 13 pm",
      "before 0 am",
      "before 11:9",
      "after 1:999",
      "after 999999999999999999999999999999",
    ].map((message) => ({ message, state: schedulePayload(state) })),
    { message: "", state: schedulePayload(state) },
  ]) {
    const r = await post("/api/plan", body);
    assert.ok([400, 422].includes(r.status), JSON.stringify(body));
  }
  assert.equal(
    (
      await post("/api/validate", {
        event_id: "invented",
        state: schedulePayload(state),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/api/plan", {
        message: "a".repeat(40000),
        state: schedulePayload(state),
      })
    ).status,
    413,
  );

  for (const preferred_time of ["morning", "afternoon", "evening", "any"]) {
    const state = { ...fresh(), preferred_time };
    const r = await (
      await post("/api/plan", {
        message: "Find events",
        previous: {},
        state: schedulePayload(state),
      })
    ).json();
    assert.deepEqual(
      r.event_ids,
      recommend(state).map((e) => e.id),
    );
  }
  assert.equal(
    (
      await post("/api/plan", {
        message: "AI",
        state: { ...schedulePayload(fresh()), preferred_time: "invalid" },
      })
    ).status,
    400,
  );
  assert.equal((await fetch(base + "/")).status, 200);
  assert.equal(
    (await fetch(base + "/assets/mascot.png")).headers.get("content-type"),
    "image/png",
  );
  for (const path of ["/Cargo.toml", "/.env", "/api/missing"])
    assert.equal((await fetch(base + path)).status, 404);
  console.log(
    "PASS: Rust API parity, follow-ups, validation, conflicts, cancellations, body limits, and static serving.",
  );
} finally {
  server.kill("SIGTERM");
  await once(server, "exit");
}
