import assert from "node:assert/strict";
import { test } from "node:test";
import { draftFromForm, restoreDrafts, MAX_DRAFTS } from "../frontend/src/eventDrafts.ts";
import { fresh } from "../frontend/src/state.ts";

const form = {
  title: "  AI study circle  ",
  topic: "AI & education",
  category: "Academic & Research",
  day: "4",
  start: "15:00",
  end: "16:30",
  location: "Learning Studio",
  host: "School of Education",
  description: "Bring a question.",
  food: "Coffee & snacks",
  cost: "0",
  rsvp: "Drop-in welcome",
  access: "open",
};

test("a complete form becomes a draft with minute times", () => {
  const r = draftFromForm(form, "draft-1", "2026-11-12T10:00:00Z");
  assert.ok("draft" in r);
  assert.equal(r.draft.title, "AI study circle");
  assert.equal(r.draft.day, 4);
  assert.equal(r.draft.start, 900);
  assert.equal(r.draft.end, 990);
  assert.equal(r.draft.cost, 0);
});

test("problems are explained in plain words", () => {
  const error = (patch: Record<string, string>) => {
    const r = draftFromForm({ ...form, ...patch }, "d", "t");
    return "error" in r ? r.error : "";
  };
  assert.equal(error({ title: " " }), "Add an event title.");
  assert.equal(error({ end: "15:00" }), "The end time must be after the start time.");
  assert.equal(error({ day: "5" }), "Choose a day in the demo week.");
  assert.equal(error({ location: "" }), "Add a location.");
  assert.match(error({ cost: "2.5" }), /whole number/);
  assert.equal(error({ topic: "Sports" }), "Choose a topic.");
  assert.equal(error({ access: "full" }), "Choose who can attend.");
});

test("saved drafts restore only when well formed, up to the limit", () => {
  assert.deepEqual(fresh().eventDrafts, []);
  const r = draftFromForm(form, "draft-1", "2026-11-12T10:00:00Z");
  assert.ok("draft" in r);
  const saved = JSON.parse(JSON.stringify(r.draft));
  assert.deepEqual(restoreDrafts([saved]), [r.draft]);
  assert.deepEqual(restoreDrafts([{ ...saved, end: 800 }]), []);
  assert.deepEqual(restoreDrafts("nope"), []);
  assert.equal(
    restoreDrafts(Array.from({ length: 30 }, (_, i) => ({ ...saved, id: `d${i}` }))).length,
    MAX_DRAFTS,
  );
});
