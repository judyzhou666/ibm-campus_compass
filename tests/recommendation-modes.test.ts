import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EVENTS } from "../frontend/src/data.ts";
import { fresh, createStore } from "../frontend/src/state.ts";
import {
  recommend,
  issue,
  overlap,
  overlappingAlternatives,
} from "../frontend/src/planner.ts";
import { createConversation } from "../frontend/src/conversation.ts";
import { createEnrollment } from "../frontend/src/enrollment.ts";
import { interpretRequest } from "../frontend/src/interpretation.ts";
import { RecommendationInfo } from "../frontend/src/RecommendationPresentation.tsx";
import { defaultPreferences } from "../frontend/src/preferences.ts";
import type { Constraints } from "../frontend/src/types.ts";
const offline: typeof fetch = async () => {
  throw Error("offline");
};
const window: Constraints = { days: [1], after: 900, before: 1020, limit: 5 };
test("discovery returns overlapping alternatives; plan-building and omitted mode remain compatible", () => {
  const s = fresh(),
    discovery = recommend(s, { ...window, mode: "discovery" });
  assert.ok(
    discovery.some((e) => e.id === "e1") &&
      discovery.some((e) => e.id === "e17"),
  );
  for (const mode of [undefined, "plan-building"] as const) {
    const plan = recommend(s, { ...window, mode });
    for (let i = 0; i < plan.length; i++)
      for (const other of plan.slice(i + 1))
        assert.equal(overlap(plan[i], other, s.buffer), false);
  }
  const e = EVENTS.find((e) => e.id === "e1")!;
  const ids = overlappingAlternatives(
    e,
    discovery.map((e) => e.id),
    s,
  );
  assert.ok(ids.includes("e17"));
  assert.match(
    renderToStaticMarkup(
      createElement(RecommendationInfo, {
        event: e,
        state: s,
        alternativeIds: ids,
      }),
    ),
    /cannot both fit your schedule/,
  );
});
test("both modes preserve commitments, planned events, eligibility and saved hard constraints", () => {
  for (const mode of ["discovery", "plan-building"] as const) {
    const s = {
      ...fresh(),
      plan: ["e1"],
      preferences: { ...defaultPreferences(), free_only: true },
    };
    const events = recommend(s, { ...window, mode });
    assert.ok(!events.some((e) => ["e1", "e17"].includes(e.id)));
    assert.ok(events.every((e) => !issue(e, s) && e.cost === 0));
    s.preferences.windows = [{ day: 0, start: 480, end: 540 }];
    assert.deepEqual(recommend(s, { ...window, mode }), []);
  }
});
test("discovery conversation retains alternatives and adding still requires RSVP/latest schedule", async () => {
  const demo = createStore(fresh()),
    c = createConversation(demo, () => {}, offline),
    enroll = createEnrollment(demo, offline);
  await c.chat("Find events", { ...window, mode: "discovery" });
  assert.ok(
    demo.read().draft.includes("e1") && demo.read().draft.includes("e17"),
  );
  assert.match(demo.read().messages.at(-1)!.text, /not a combined plan/);
  assert.equal((await enroll.choose("e1")).kind, "rsvp");
  assert.deepEqual(demo.read().plan, []);
  await enroll.confirm({ display_name: "Demo", attending: true });
  assert.deepEqual(demo.read().plan, ["e1"]);
  assert.equal((await enroll.choose("e17")).kind, "rejected");
});
test("explicit weekly planning and discovery requests select modes without dropping hard filters", () => {
  const previous: Constraints = { ...window, free: true };
  assert.equal(
    interpretRequest("Build a weekly plan", previous).constraints.mode,
    "plan-building",
  );
  assert.equal(
    interpretRequest("Discover events", { ...previous, mode: "plan-building" })
      .constraints.mode,
    "discovery",
  );
  assert.equal(
    interpretRequest("Build a weekly plan", previous).constraints.free,
    true,
  );
  assert.deepEqual(
    interpretRequest("start over", { ...previous, mode: "discovery" })
      .constraints,
    { mode: "discovery" },
  );
  assert.throws(
    () =>
      interpretRequest("Find events", {
        mode: "bad",
      } as unknown as Constraints),
    /mode/,
  );
});
