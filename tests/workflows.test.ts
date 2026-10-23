import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, fresh } from "../frontend/src/state.ts";
import { createEnrollment } from "../frontend/src/enrollment.ts";
import { createConversation } from "../frontend/src/conversation.ts";
import type { Constraints } from "../frontend/src/types.ts";

const rsvp = { display_name: "Demo student", attending: true };
const enrolled = () =>
  Response.json({
    event_id: "e1",
    demo: true,
    status: "enrolled",
    rsvp_confirmed: true,
  });
const planned = (ids = ["e1"], constraints: Constraints = {}) =>
  Response.json({
    mode: "simulated",
    understood: true,
    provider: "rust-rules",
    constraints,
    event_ids: ids,
  });
function transport() {
  const calls: {
    resolve: (response: Response) => void;
  }[] = [];
  const fetcher: typeof fetch = async () =>
    new Promise<Response>((resolve) => {
      calls.push({ resolve });
    });
  return { calls, fetcher };
}
function setup(fetcher: typeof fetch) {
  const demo = createStore(fresh());
  const enrollment = createEnrollment(demo, fetcher);
  return {
    demo,
    enrollment,
    conversation: createConversation(demo, enrollment.remove, fetcher),
  };
}

test("enrollment owns approval, calendar/RSVP changes, cancellation and fresh approval on re-add", async () => {
  const { fetcher, calls } = transport();
  const { demo, enrollment } = setup(fetcher);
  demo.update((s) => ({ ...s, draft: ["e1", "e5"] }));
  assert.equal((await enrollment.confirm(rsvp)).kind, "ignored");
  assert.equal((await enrollment.choose("e1")).kind, "rsvp");
  assert.equal(calls.length, 0);
  enrollment.cancel();
  assert.equal(enrollment.read().rsvpEvent, null);
  assert.deepEqual(demo.read().plan, []);
  await enrollment.choose("e1");
  assert.equal(
    (await enrollment.confirm({ ...rsvp, attending: false })).kind,
    "rejected",
  );
  assert.equal(calls.length, 0);
  const pending = enrollment.confirm(rsvp);
  enrollment.cancel();
  assert.equal(enrollment.read().rsvpEvent, "e1");
  assert.equal((await enrollment.choose("e5")).kind, "ignored");
  assert.equal((await enrollment.confirm(rsvp)).kind, "ignored");
  calls[0].resolve(enrolled());
  assert.equal((await pending).kind, "added");
  assert.deepEqual(demo.read().plan, ["e1"]);
  assert.deepEqual(demo.read().rsvps, ["e1"]);
  assert.deepEqual(demo.read().draft, ["e5"]);
  assert.equal((await enrollment.choose("e1")).kind, "already-added");
  enrollment.remove("e1");
  assert.deepEqual(demo.read().rsvps, []);
  assert.equal((await enrollment.choose("e1")).kind, "rsvp");
  assert.equal(calls.length, 1);
  assert.deepEqual(demo.read().plan, []);
});

for (const change of ["busy time", "cancellation"] as const) {
  test(`enrollment rechecks current ${change} after confirmation`, async () => {
    const { fetcher, calls } = transport();
    const { demo, enrollment } = setup(fetcher);
    await enrollment.choose("e1");
    const pending = enrollment.confirm(rsvp);
    demo.update((s) =>
      change === "cancellation"
        ? { ...s, cancelled: ["e1"] }
        : {
            ...s,
            blocks: [
              ...s.blocks,
              { id: "new", title: "New class", day: 1, start: 900, end: 990 },
            ],
          },
    );
    calls[0].resolve(enrolled());
    assert.equal((await pending).kind, "rejected");
    assert.deepEqual(demo.read().plan, []);
    assert.deepEqual(demo.read().rsvps, []);
    assert.equal(enrollment.read().busy, false);
  });
}

for (const staleResponse of [
  enrolled,
  () => new Response("{}", { status: 409 }),
]) {
  test("reset discards old enrollment success/error without unlocking a newer addition", async () => {
    const { fetcher, calls } = transport();
    const { demo, enrollment } = setup(fetcher);
    await enrollment.choose("e1");
    const old = enrollment.confirm(rsvp);
    enrollment.reset();
    demo.update(fresh);
    await enrollment.choose("e1");
    const latest = enrollment.confirm(rsvp);
    calls[0].resolve(staleResponse());
    assert.equal((await old).kind, "ignored");
    assert.equal(enrollment.read().busy, true);
    assert.deepEqual(demo.read().plan, []);
    calls[1].resolve(enrolled());
    assert.equal((await latest).kind, "added");
    assert.deepEqual(demo.read().plan, ["e1"]);
  });
}

test("removing an event invalidates its pending addition", async () => {
  const { fetcher, calls } = transport();
  const { demo, enrollment } = setup(fetcher);
  await enrollment.choose("e1");
  const pending = enrollment.confirm(rsvp);
  enrollment.remove("e1");
  calls[0].resolve(enrolled());
  assert.equal((await pending).kind, "ignored");
  assert.deepEqual(demo.read().plan, []);
});

test("an approved offline drop-in addition updates the calendar with an explicit demo notice", async () => {
  const { demo, enrollment } = setup(async () => {
    throw new Error("offline");
  });
  const result = await enrollment.choose("e5");
  assert.equal(result.kind, "added");
  if (result.kind === "added")
    assert.match(result.notice, /locally in demo mode/);
  assert.deepEqual(demo.read().plan, ["e5"]);
  assert.deepEqual(demo.read().rsvps, []);
});

test("new chat invalidates planning without cancelling an independently approved enrollment", async () => {
  const { fetcher, calls } = transport();
  const { demo, enrollment, conversation } = setup(fetcher);
  await enrollment.choose("e1");
  const addition = enrollment.confirm(rsvp);
  const planning = conversation.chat("AI");
  conversation.clear();
  calls[1].resolve(planned());
  calls[0].resolve(enrolled());
  await planning;
  assert.equal((await addition).kind, "added");
  assert.deepEqual(demo.read().plan, ["e1"]);
  assert.deepEqual(demo.read().messages, []);
});

for (const change of [
  "schedule",
  "preferences",
  "preferred time",
  "constraints",
] as const) {
  test(`conversation rejects results after ${change} changes`, async () => {
    const { fetcher, calls } = transport();
    const { demo, conversation } = setup(fetcher);
    const pending = conversation.chat("AI");
    await conversation.chat("career");
    assert.equal(calls.length, 1);
    demo.update((s) =>
      change === "schedule"
        ? { ...s, cancelled: ["e1"] }
        : change === "preferences"
          ? { ...s, interests: ["Social"] }
          : change === "preferred time"
            ? { ...s, preferred_time: "evening" }
            : { ...s, constraints: { days: [3] } },
    );
    calls[0].resolve(planned());
    await pending;
    assert.deepEqual(demo.read().draft, []);
    assert.match(demo.read().messages.at(-1)!.text, /changed/);
    assert.equal(conversation.read().busy, false);
    assert.deepEqual(demo.read().plan, []);
  });
}

for (const reset of [false, true]) {
  for (const staleResponse of [
    planned,
    () => new Response("{}", { status: 400 }),
  ]) {
    test(`${reset ? "reset" : "new chat"} discards old planning success/error while newer work stays busy`, async () => {
      const { fetcher, calls } = transport();
      const { demo, conversation } = setup(fetcher);
      const old = conversation.chat("AI");
      if (reset) {
        conversation.reset();
        demo.update(fresh);
      } else conversation.clear();
      const latest = conversation.chat("career");
      calls[0].resolve(staleResponse());
      await old;
      assert.equal(conversation.read().busy, true);
      assert.deepEqual(demo.read().messages, [
        { role: "user", text: "career" },
      ]);
      calls[1].resolve(planned(["e20"], { topics: ["Career"] }));
      await latest;
      assert.deepEqual(demo.read().draft, ["e20"]);
      assert.equal(conversation.read().mode, "Rust planner · Simulated");
      assert.equal(conversation.read().busy, false);
    });
  }
}

test("planning errors release busy state and unsupported requests get explicit feedback", async () => {
  const { fetcher, calls } = transport();
  const { demo, conversation } = setup(fetcher);
  const failed = conversation.chat("AI");
  calls[0].resolve(new Response("{}", { status: 400 }));
  await failed;
  assert.equal(conversation.read().busy, false);
  assert.match(demo.read().messages.at(-1)!.text, /could not accept/);
  await conversation.chat("purple flying giraffes");
  assert.equal(calls.length, 1);
  assert.match(demo.read().messages.at(-1)!.text, /limited demo planner/);
  assert.equal(conversation.read().busy, false);
});

test("replacement preserves every filter and asks the student before changing them", async () => {
  const bodies: { previous: Constraints }[] = [];
  const fetcher: typeof fetch = async (_path, options) => {
    const body: { previous: Constraints } = JSON.parse(String(options?.body));
    bodies.push(body);
    return planned([], body.previous);
  };
  const { demo, conversation } = setup(fetcher);
  const previous = {
    topics: ["Career"],
    days: [1],
    after: 780,
    before: 1020,
    free: true,
    food: "Coffee & snacks",
    excluded: ["Social"],
  };
  demo.update((s) => ({
    ...s,
    plan: ["e1", "e2"],
    rsvps: ["e1"],
    cancelled: ["e1"],
    constraints: previous,
  }));
  await conversation.chat("find a replacement");
  assert.equal(bodies.length, 1);
  assert.deepEqual(bodies[0].previous, {
    ...previous,
    limit: 1,
    mode: "discovery",
  });
  assert.deepEqual(demo.read().plan, ["e2"]);
  assert.deepEqual(demo.read().rsvps, []);
  assert.deepEqual(demo.read().draft, []);
  assert.match(
    demo.read().messages.at(-1)!.text,
    /explicitly request a different/,
  );
  assert.match(
    demo.read().messages.at(-1)!.text,
    /Conversations beyond your major/,
  );
});

test("replacement carries Rust evidence and RSVP requirements without adding the alternative", async () => {
  const evidence = {
    event_id: "e5",
    interest_match: "AI",
    schedule_fit: "Thursday",
    practical: "Drop-in welcome",
    trade_offs: "Fictional record",
  };
  const { demo, conversation } = setup(async (_path, options) => {
    const body: { previous: Constraints } = JSON.parse(String(options?.body));
    return Response.json({
      mode: "simulated",
      understood: true,
      constraints: body.previous,
      event_ids: ["e5"],
      recommendations: [evidence],
    });
  });
  demo.update((s) => ({
    ...s,
    plan: ["e1", "e2"],
    rsvps: ["e1"],
    cancelled: ["e1"],
  }));
  await conversation.replace();
  assert.deepEqual(demo.read().plan, ["e2"]);
  assert.deepEqual(demo.read().rsvps, []);
  assert.deepEqual(demo.read().draft, ["e5"]);
  assert.deepEqual(demo.read().messages.at(-1)!.evidence, [evidence]);
  assert.match(demo.read().messages.at(-1)!.text, /Drop-in welcome/);
  assert.match(demo.read().messages.at(-1)!.text, /suggestion only/);
});

test("replacement discards a result after new chat", async () => {
  const { fetcher, calls } = transport();
  const { demo, conversation } = setup(fetcher);
  demo.update((s) => ({ ...s, plan: ["e1"], cancelled: ["e1"] }));
  const pending = conversation.replace();
  conversation.clear();
  calls[0].resolve(planned([]));
  await pending;
  assert.equal(calls.length, 1);
  assert.deepEqual(demo.read().messages, []);
});

test("a schedule change during replacement prevents accepting the alternative", async () => {
  const { demo, conversation } = setup(async (_path, options) => {
    const body: { previous: Constraints } = JSON.parse(String(options?.body));
    demo.update((s) => ({ ...s, cancelled: [...s.cancelled, "e5"] }));
    return planned(["e5"], body.previous);
  });
  demo.update((s) => ({
    ...s,
    plan: ["e1"],
    cancelled: ["e1"],
    constraints: { days: [1] },
  }));
  await conversation.replace();
  assert.deepEqual(demo.read().draft, []);
  assert.match(demo.read().messages.at(-1)!.text, /schedule changed/);
  assert.equal(conversation.read().busy, false);
});

test("offline conversation recognizes parser synonyms and keeps the calendar unchanged", async () => {
  const { demo, conversation } = setup(async () => {
    throw new Error("offline");
  });
  for (const text of [
    "professional",
    "ceramics",
    "balance",
    "snack",
    "refreshment",
    "options",
    "any day",
  ]) {
    await conversation.chat(text, {});
    assert.match(
      demo.read().messages.at(-1)!.text,
      /Rust planner is unavailable/,
    );
    assert.equal(conversation.read().mode, "Browser fallback · Simulated");
  }
  assert.deepEqual(demo.read().plan, []);
});

for (const request of ["career after 3", "career on Thursday after 3"]) {
  for (const answer of ["PM", "after 3 PM"]) {
    for (const offline of [true, false]) {
      test(`AM/PM clarification retains ${request} context for ${answer}, offline=${offline}`, async () => {
        const fetcher: typeof fetch = async (_path, options) => {
          if (offline) throw Error("offline");
          const body = JSON.parse(String(options?.body));
          assert.deepEqual(body.previous.topics, ["Career"]);
          assert.deepEqual(
            body.previous.days,
            request.includes("Thursday") ? [3] : undefined,
          );
          assert.equal(body.previous.after, undefined);
          const { interpretRequest } =
            await import("../frontend/src/interpretation.ts");
          const { recommend } = await import("../frontend/src/planner.ts");
          const parsed = interpretRequest(body.message, body.previous);
          return planned(
            recommend({ ...fresh(), ...body.state }, parsed.constraints).map(
              (e) => e.id,
            ),
            parsed.constraints,
          );
        };
        const { demo, conversation } = setup(fetcher);
        await conversation.chat(request);
        assert.match(demo.read().messages.at(-1)!.text, /AM or PM/);
        assert.equal(demo.read().constraints.after, undefined);
        assert.deepEqual(demo.read().draft, []);
        await conversation.chat(answer);
        assert.deepEqual(demo.read().constraints.topics, ["Career"]);
        assert.deepEqual(
          demo.read().constraints.days,
          request.includes("Thursday") ? [3] : undefined,
        );
        assert.equal(demo.read().constraints.after, 900);
        assert.deepEqual(
          demo.read().draft,
          request.includes("Thursday") ? ["e28"] : ["e20", "e28"],
        );
        assert.deepEqual(demo.read().plan, []);
        assert.deepEqual(demo.read().rsvps, []);
      });
    }
  }
}
test("new chat discards pending clarification context", async () => {
  const { demo, conversation } = setup(async () => {
    throw Error("offline");
  });
  await conversation.chat("career after 3");
  conversation.clear();
  await conversation.chat("PM");
  assert.match(demo.read().messages.at(-1)!.text, /limited demo/);
  assert.deepEqual(demo.read().constraints, {});
});

for (const offline of [false, true]) {
  for (const scenario of [
    {
      request: "career on Thursday after 3",
      partial: "before 5 PM",
      complete: "after 3 PM before 5 PM",
      ids: [],
      topic: "Career",
    },
    {
      request: "social but not Tuesday after 3",
      partial: "PM",
      complete: "social on Thursday after 3 PM",
      ids: ["e2"],
      topic: "Social",
    },
    {
      request: "social but not Tuesday after 3",
      partial: "after 3 PM",
      complete: "social on Thursday after 3 PM",
      ids: ["e2"],
      topic: "Social",
    },
    {
      request: "career near me after 3",
      partial: "PM",
      complete: "career on Thursday after 3 PM",
      ids: ["e28"],
      topic: "Career",
    },
    {
      request: "career on Thursday after 3 before 5",
      partial: "after 3 PM",
      complete: "after 3 PM before 5 PM",
      ids: [],
      topic: "Career",
    },
    {
      request: "career on Thursday after 3 before 5",
      partial: "before 5 PM",
      complete: "after 3 PM before 5 PM",
      ids: [],
      topic: "Career",
    },
  ]) {
    test(`all clarification parts retained: ${scenario.request} / ${scenario.partial} offline=${offline}`, async () => {
      let calls = 0;
      const fetcher: typeof fetch = async (_path, options) => {
        calls++;
        if (offline) throw Error("offline");
        const body = JSON.parse(String(options?.body));
        const { interpretRequest } =
          await import("../frontend/src/interpretation.ts");
        const { recommend } = await import("../frontend/src/planner.ts");
        const parsed = interpretRequest(body.message, body.previous);
        assert.equal(parsed.clarification, undefined);
        return planned(
          recommend({ ...fresh(), ...body.state }, parsed.constraints).map(
            (e) => e.id,
          ),
          parsed.constraints,
        );
      };
      const { demo, conversation } = setup(fetcher);
      await conversation.chat(scenario.request);
      await conversation.chat(scenario.partial);
      assert.equal(calls, 0);
      assert.deepEqual(demo.read().draft, []);
      assert.deepEqual(demo.read().constraints, {});
      assert.match(demo.read().messages.at(-1)!.text, /complete request/);
      await conversation.chat("PM");
      assert.equal(calls, 0);
      await conversation.chat(scenario.complete);
      assert.equal(calls, 1);
      assert.deepEqual(demo.read().draft, scenario.ids);
      assert.deepEqual(demo.read().constraints.topics, [scenario.topic]);
      assert.deepEqual(demo.read().constraints.days, [3]);
      assert.equal(demo.read().constraints.after, 900);
      if (scenario.complete.includes("before"))
        assert.equal(demo.read().constraints.before, 1020);
      assert.deepEqual(demo.read().plan, []);
      assert.deepEqual(demo.read().rsvps, []);
    });
  }
}
