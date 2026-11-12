/**
 * Planner dates and relevance: month-day dates are limited to the demo week
 * (Nov 2–6, 2026), and events that mention the student's own words rank first.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { interpretRequest } from "../frontend/src/interpretation.ts";
import { parseDemoDates } from "../frontend/src/demoDates.ts";
import { recommend, relevance } from "../frontend/src/planner.ts";
import { EVENTS } from "../frontend/src/data.ts";
import { createConversation } from "../frontend/src/conversation.ts";
import { createStore, fresh } from "../frontend/src/state.ts";

const offline = async () => {
  throw Error("offline");
};

describe("demo-week dates", () => {
  it("keeps only the demo-week days of a range", () => {
    assert.deepEqual(parseDemoDates("week nov 6-12"), {
      days: [4],
      partial: true,
      requested: "Nov 6–12",
    });
    assert.deepEqual(parseDemoDates("november 3rd to 4th")?.days, [1, 2]);
    assert.deepEqual(parseDemoDates("oct 30 - nov 3")?.days, [0, 1]);
    assert.equal(parseDemoDates("oct 30 - nov 3")?.requested, "Oct 30 – Nov 3");
    assert.deepEqual(parseDemoDates("nov 2 through 6"), {
      days: [0, 1, 2, 3, 4],
      partial: false,
      requested: "Nov 2–6",
    });
  });

  it("ignores impossible dates and text without a date", () => {
    assert.equal(parseDemoDates("nov 31"), null);
    assert.equal(parseDemoDates("ai events on friday"), null);
    assert.equal(parseDemoDates("3 events"), null);
  });

  it("dates set the days and override weekday words", () => {
    const r = interpretRequest("AI on Monday Nov 5");
    assert.deepEqual(r.constraints.days, [3]);
    assert.equal(r.clarification, undefined);
  });

  it("dates outside the demo week ask for a day in that week", () => {
    const r = interpretRequest("AI in education events for Nov 7-12");
    assert.equal(r.understood, true);
    assert.equal(r.constraints.days, undefined);
    assert.equal(
      r.clarification,
      "Campus Compass only has fictional events for the demo week, Mon Nov 2 – Fri Nov 6, 2026, so there is nothing on Nov 7–12. Ask about a day in that week, for example “AI events on Friday”.",
    );
  });

  it("a partly covered range says which days were searched", async () => {
    const demo = createStore(fresh());
    const conversation = createConversation(demo, () => {}, offline);
    await conversation.chat("AI in education relevant events for week Nov 6-12");
    const last = demo.read().messages.at(-1)!;
    assert.match(
      last.text,
      /The demo week is Mon Nov 2 – Fri Nov 6, 2026, so for Nov 6–12 I searched Fri Nov 6 only\./,
    );
    assert.ok(last.eventIds?.length, last.text);
    for (const id of last.eventIds ?? [])
      assert.equal(EVENTS.find((e) => e.id === id)!.day, 4);
  });

  it("a range fully inside the week adds no lead", async () => {
    const demo = createStore(fresh());
    const conversation = createConversation(demo, () => {}, offline);
    await conversation.chat("AI events Nov 2-6");
    assert.ok(!demo.read().messages.at(-1)!.text.includes("The demo week is"));
  });
});

describe("relevance to the student's words", () => {
  it("keeps the words that chose the topic, not whole-category names", () => {
    assert.deepEqual(
      interpretRequest("AI in education events").constraints.focus,
      ["ai", "education"],
    );
    assert.equal(interpretRequest("career events").constraints.focus, undefined);
    assert.deepEqual(
      interpretRequest("AI career social").constraints.focus,
      ["ai"],
    );
    assert.equal(interpretRequest("no AI events").constraints.focus, undefined);
  });

  it("'AI in education' picks events that mention AI and education", () => {
    const r = interpretRequest("AI in education events");
    const picks = recommend(fresh(), r.constraints);
    assert.equal(picks.length, 3);
    for (const e of picks) assert.equal(relevance(e, ["ai", "education"]), 2, e.title);
    const titles = picks.map((e) => e.title);
    assert.ok(!titles.includes("Creative coding introduction"), titles.join(", "));
  });

  it("without focus terms the ranking is unchanged", () => {
    const state = fresh();
    assert.deepEqual(
      recommend(state, { topics: ["AI & education"] }).map((e) => e.id),
      ["e18", "e14", "e1"],
    );
  });

  it("matches whole words only", () => {
    const e = EVENTS.find((x) => x.title === "Creative coding introduction")!;
    // "ai" must not match inside words such as "maintain" or "paint".
    assert.equal(relevance({ ...e, description: "Paint and maintain." }, ["ai"]), 0);
  });
});
