import { evolvingClarifications } from "./clarification-fixtures.ts";
import { interpretRequest } from "../frontend/src/interpretation.ts";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { EVENTS } from "../frontend/src/data.ts";
import { createConversation } from "../frontend/src/conversation.ts";
import { fresh, createStore } from "../frontend/src/state.ts";
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
  // Old callers may omit preferences and still send block titles; new ones omit labels.
  const modern = schedulePayload(state);
  const { preferences: _preferences, ...legacy } = modern;
  const legacyResponse = await post("/api/plan", {
    message: "Find events",
    state: {
      ...legacy,
      blocks: state.blocks.map(({ title, day, start, end }) => ({
        title,
        day,
        start,
        end,
      })),
    },
  });
  const modernResponse = await post("/api/plan", {
    message: "Find events",
    state: modern,
  });
  assert.equal(legacyResponse.status, 200);
  assert.equal(modernResponse.status, 200);
  assert.deepEqual(
    (await legacyResponse.json()).event_ids,
    (await modernResponse.json()).event_ids,
  );
  assert.ok(modern.blocks.every((block) => !("title" in block)));
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
      assert.match(
        evidence.schedule_fit,
        /No conflict with the commitments you entered/,
      );
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

  for (const message of [
    "arts on Wednesday evening under $5",
    "arts budget 5",
    "arts less than 5 dollars",
  ]) {
    const result = await (
      await post("/api/plan", { message, state: schedulePayload(state) })
    ).json();
    assert.match(result.clarification, /Numeric budgets are not supported/);
    assert.deepEqual(result.event_ids, []);
  }
  const pending = await (
    await post("/api/plan", {
      message: "career on Thursday after 3",
      state: schedulePayload(state),
    })
  ).json();
  assert.equal(pending.constraints.after, undefined);
  assert.deepEqual(pending.constraints.topics, ["Career"]);
  const resolved = await (
    await post("/api/plan", {
      message: "after 3 PM",
      previous: pending.constraints,
      state: schedulePayload(state),
    })
  ).json();
  assert.deepEqual(resolved.event_ids, ["e28"]);
  assert.equal(resolved.constraints.after, 900);

  for (const answer of ["PM", "after 3 PM"]) {
    for (const offline of [false, true]) {
      const demo = createStore(fresh());
      const fetcher: typeof fetch = async (path, options) => {
        if (offline) throw Error("offline");
        return fetch(base + String(path), options);
      };
      const conversation = createConversation(
        demo,
        () => {
          throw Error("No calendar removal expected");
        },
        fetcher,
      );
      await conversation.chat("career after 3");
      assert.equal(demo.read().constraints.after, undefined);
      await conversation.chat(answer);
      assert.deepEqual(demo.read().constraints.topics, ["Career"]);
      assert.equal(demo.read().constraints.after, 900);
      assert.deepEqual(demo.read().draft, ["e20", "e28"]);
      assert.deepEqual(demo.read().plan, []);
      assert.deepEqual(demo.read().rsvps, []);
    }
  }
  for (const [message, limit] of [
    ["career up to 3 events", 3],
    ["career at most 2 options", 2],
    ["career no more than 1 choices", 1],
  ] as const) {
    const response = await post("/api/plan", {
      message,
      state: schedulePayload(state),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.clarification, null);
    assert.equal(result.constraints.limit, limit);
    assert.deepEqual(
      result.event_ids,
      recommend(state, { topics: ["Career"], limit }).map((e) => e.id),
    );
  }
  const budgetWithCount = await (
    await post("/api/plan", {
      message: "career up to 3 events under $5",
      state: schedulePayload(state),
    })
  ).json();
  assert.match(
    budgetWithCount.clarification,
    /Numeric budgets are not supported/,
  );
  assert.deepEqual(budgetWithCount.event_ids, []);

  for (const message of [
    "social but not Tuesday after 3",
    "career near me after 3",
  ]) {
    const r = await (
      await post("/api/plan", { message, state: schedulePayload(state) })
    ).json();
    assert.match(r.clarification, /complete request/);
    assert.equal(r.constraints.days, undefined);
    assert.equal(r.constraints.after, undefined);
    assert.deepEqual(r.event_ids, []);
  }
  for (const offline of [false, true]) {
    for (const partial of ["after 3 PM", "before 5 PM"]) {
      const demo = createStore(fresh());
      let calls = 0;
      const fetcher: typeof fetch = async (path, options) => {
        calls++;
        if (offline) throw Error("offline");
        return fetch(base + String(path), options);
      };
      const conversation = createConversation(
        demo,
        () => {
          throw Error("Unexpected calendar change");
        },
        fetcher,
      );
      await conversation.chat("career on Thursday after 3 before 5");
      await conversation.chat(partial);
      assert.equal(calls, 0);
      assert.deepEqual(demo.read().draft, []);
      await conversation.chat("after 3 PM before 5 PM");
      assert.equal(calls, 1);
      assert.deepEqual(demo.read().constraints, {
        topics: ["Career"],
        days: [3],
        after: 900,
        before: 1020,
        mode: "discovery",
      });
      assert.deepEqual(demo.read().plan, []);
    }
    for (const original of [
      "social but not Tuesday after 3",
      "social near me after 3",
    ]) {
      const demo = createStore(fresh());
      let calls = 0;
      const fetcher: typeof fetch = async (path, options) => {
        calls++;
        if (offline) throw Error("offline");
        return fetch(base + String(path), options);
      };
      const conversation = createConversation(demo, () => {}, fetcher);
      await conversation.chat(original);
      await conversation.chat("PM");
      assert.equal(calls, 0);
      await conversation.chat("social on Thursday after 3 PM");
      assert.deepEqual(demo.read().draft, ["e2"]);
      assert.deepEqual(demo.read().plan, []);
    }
  }

  const { defaultPreferences } = await import("../frontend/src/preferences.ts");
  for (const participation of [
    [],
    ["independent"],
    ["small-group"],
    ["one-to-one"],
  ]) {
    for (const learning of [true, false]) {
      const s = {
        ...fresh(),
        interests: ["AI & education"],
        preferences: {
          ...defaultPreferences(),
          count: 1 as const,
          participation,
          use_learning: learning,
          learning_topics: [
            { topic: "Career", source: "Added by you" as const },
          ],
        },
      };
      const result = await (
        await post("/api/plan", {
          message: "Find events",
          state: schedulePayload(s),
        })
      ).json();
      assert.deepEqual(
        result.event_ids,
        recommend(s).map((e) => e.id),
      );
      assert.equal(result.event_ids.length, 1);
    }
  }
  const strict = {
    ...fresh(),
    preferences: {
      ...defaultPreferences(),
      free_only: true,
      windows: [{ day: 2, start: 1020, end: 1200 }],
    },
  };
  assert.deepEqual(
    (
      await (
        await post("/api/plan", {
          message: "arts on Wednesday evening",
          state: schedulePayload(strict),
        })
      ).json()
    ).event_ids,
    [],
  );
  assert.equal(
    (
      await post("/api/enroll", {
        event_id: "e29",
        state: schedulePayload(strict),
      })
    ).status,
    409,
  );
  for (const preferences of [
    { version: 2 },
    { primary_topics: ["Career"], goal_topics: [] },
    { count: 9 },
    { count: "3" },
    { count: true },
    { participation: Array(5).fill("open") },
    { goal_topics: Array(6).fill("Career") },
    { learning_topics: Array(6).fill("Career") },
    { windows: Array(21).fill({ day: 0, start: 600, end: 660 }) },
    { dismissed: Array(EVENTS.length + 1).fill("e1") },
    { guidance: "infer-ability" },
    { participation: ["unknown"] },
    { learning_topics: ["fake"] },
    { windows: [{ day: 9, start: 1, end: 5 }] },
    { why: "MUST_NOT_TRANSMIT" },
  ]) {
    assert.ok(
      [400, 422].includes(
        (
          await post("/api/plan", {
            message: "Find events",
            state: { ...schedulePayload(fresh()), preferences },
          })
        ).status,
      ),
    );
  }

  for (const count of [1, 3, 5] as const)
    for (const useGoals of [false, true]) {
      const s = {
        ...fresh(),
        interests: [],
        preferences: {
          ...defaultPreferences(),
          count,
          use_goals: useGoals,
          goals: ["career"],
          primary_goal: "career",
          use_learning: true,
          learning_topics: [
            { topic: "Arts & culture", source: "Added by you" as const },
          ],
        },
      };
      for (const previous of [
        {},
        { explore: true },
        { topics: ["AI & education"] },
      ]) {
        const r = await (
          await post("/api/plan", {
            message: "Find events",
            previous,
            state: schedulePayload(s),
          })
        ).json();
        assert.deepEqual(
          r.event_ids,
          recommend(s, previous).map((e) => e.id),
        );
        assert.ok(r.event_ids.length <= count);
      }
    }
  for (const offline of [false, true]) {
    for (const scenario of evolvingClarifications) {
      const demo = createStore(fresh());
      let calls = 0;
      const conversation = createConversation(
        demo,
        () => {
          throw Error("Unexpected removal");
        },
        async (path, options) => {
          calls++;
          if (offline) throw Error("offline");
          return fetch(base + String(path), options);
        },
      );
      await conversation.chat("career on Thursday after 3");
      await conversation.chat(scenario.partial);
      await conversation.chat(scenario.incomplete);
      assert.equal(calls, 0);
      assert.deepEqual(demo.read().draft, []);
      await conversation.chat(scenario.complete);
      assert.equal(calls, 1);
      assert.deepEqual(demo.read().constraints.topics, scenario.topics);
      assert.deepEqual(demo.read().constraints.days, scenario.days);
      assert.equal(demo.read().constraints.after, 900);
      assert.equal(demo.read().constraints.before, scenario.before);
      assert.deepEqual(demo.read().draft, scenario.ids);
      assert.deepEqual(demo.read().plan, []);
      assert.deepEqual(demo.read().rsvps, []);
    }
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
    const redacted = {
      ...state,
      blocks: state.blocks.map((b) => ({ ...b, title: "Busy commitment" })),
    };
    assert.equal(r.issue, issue(event, redacted));
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
