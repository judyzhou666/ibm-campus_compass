import assert from "node:assert/strict";
import { test } from "node:test";
import { twelveHour } from "../frontend/src/PlannerPanels.tsx";
import { reasons } from "../frontend/src/planner.ts";
import { EVENTS } from "../frontend/src/data.ts";
import { fresh } from "../frontend/src/state.ts";

test("planner evidence times read in 12-hour format, including midnight", () => {
  assert.equal(
    twelveHour("Friday, 09:05–24:00; start at/after 12:00"),
    "Friday, 9:05 AM–12:00 AM; start at/after 12:00 PM",
  );
  assert.equal(twelveHour("CC-005, $12"), "CC-005, $12");
});

test("why-this-fits uses the chat's requested topics and keeps acronyms", () => {
  const event = EVENTS.find((e) => e.topic === "AI & education")!;
  const state = { ...fresh(), interests: [] };
  assert.match(reasons(event, state)[0], /^An opportunity to explore AI & education$/);
  assert.equal(
    reasons(event, state, { topics: ["AI & education"] })[0],
    "Matches your interest in AI & education",
  );
});
