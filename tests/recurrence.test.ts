/** Calendar repeat rules (Google Calendar / Canvas style) and the event dialog's save rules. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanRule,
  describeRule,
  occursOn,
  presetLabel,
  shiftSeries,
} from "../frontend/src/recurrence.ts";
import { busyBlocks } from "../frontend/src/personalEvents.ts";
import { itemsForDate } from "../frontend/src/calendarGrid.ts";
import { restore, fresh } from "../frontend/src/state.ts";
import {
  ruleProblem,
  savePayload,
} from "../frontend/src/PersonalEventDialog.tsx";
import type { PersonalEvent } from "../frontend/src/types.ts";

// Demo week: Mon Nov 2 – Fri Nov 6, 2026. Nov 3, 2026 is a Tuesday.
const pe = (o: Partial<PersonalEvent>): PersonalEvent => ({
  id: "p",
  title: "Item",
  date: "2026-11-03",
  start: 540,
  end: 600,
  repeat: "none",
  ...o,
});
const on = (p: PersonalEvent, ...dates: string[]) =>
  dates.map((d) => occursOn(p, d));

test("dropdown labels match Google Calendar / Canvas wording", () => {
  const d = "2026-11-03";
  assert.equal(presetLabel("none", d), "Does not repeat");
  assert.equal(presetLabel("daily", d), "Daily");
  assert.equal(presetLabel("weekly", d), "Weekly on Tuesday");
  assert.equal(presetLabel("monthly", d), "Monthly on the first Tuesday");
  assert.equal(presetLabel("yearly", d), "Annually on November 3");
  assert.equal(presetLabel("weekdays", d), "Every weekday (Monday to Friday)");
  assert.equal(presetLabel("custom", d), "Custom…");
  assert.equal(
    presetLabel("monthly", "2026-11-19"),
    "Monthly on the third Thursday",
  );
});

test("presets: none, daily, weekly, weekdays, monthly, yearly", () => {
  assert.deepEqual(on(pe({}), "2026-11-03", "2026-11-10"), [true, false]);
  assert.deepEqual(
    on(pe({ repeat: "daily" }), "2026-11-02", "2026-11-03", "2026-11-07"),
    [false, true, true],
  );
  assert.deepEqual(
    on(pe({ repeat: "weekly" }), "2026-11-10", "2026-11-11", "2027-01-05"),
    [true, false, true],
  );
  assert.deepEqual(
    on(
      pe({ repeat: "weekdays" }),
      "2026-11-04",
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
    ),
    [true, false, false, true],
  );
  // First Tuesday of each month: Dec 1, 2026 and Jan 5, 2027.
  assert.deepEqual(
    on(
      pe({ repeat: "monthly" }),
      "2026-12-01",
      "2026-12-03",
      "2027-01-05",
      "2027-01-12",
    ),
    [true, false, true, false],
  );
  assert.deepEqual(on(pe({ repeat: "yearly" }), "2027-11-03", "2027-11-02"), [
    true,
    false,
  ]);
});

test("custom: every 2 weeks on Tue and Thu, ending after 4 times", () => {
  const p = pe({
    repeat: "custom",
    rule: { unit: "week", interval: 2, weekdays: [1, 3], count: 4 },
  });
  assert.deepEqual(
    on(
      p,
      "2026-11-03",
      "2026-11-05",
      "2026-11-10",
      "2026-11-17",
      "2026-11-19",
      "2026-12-01",
    ),
    [true, true, false, true, true, false],
  );
  assert.equal(
    describeRule(p.rule!, p.date),
    "Every 2 weeks on Tue, Thu, 4 times",
  );
});

test("custom: every 3 days until a date; monthly on the same day", () => {
  const p = pe({
    repeat: "custom",
    rule: { unit: "day", interval: 3, until: "2026-11-09" },
  });
  assert.deepEqual(on(p, "2026-11-06", "2026-11-09", "2026-11-12"), [
    true,
    true,
    false,
  ]);
  const m = pe({
    repeat: "custom",
    rule: { unit: "month", interval: 1, monthly: "date" },
  });
  assert.deepEqual(on(m, "2026-12-03", "2026-12-01"), [true, false]);
  assert.equal(
    describeRule(p.rule!, p.date),
    "Every 3 days, until Nov 9, 2026",
  );
});

test("busy time: a daily item blocks every demo weekday it covers", () => {
  const blocks = busyBlocks({
    blocks: [],
    personalEvents: [pe({ repeat: "daily" })],
  });
  assert.deepEqual(
    blocks.map((b) => b.day),
    [1, 2, 3, 4],
  );
  assert.equal(new Set(blocks.map((b) => b.id)).size, 4);
  const one = busyBlocks({
    blocks: [],
    personalEvents: [pe({ repeat: "weekly" })],
  });
  assert.deepEqual(
    one.map((b) => [b.id, b.day]),
    [["p", 1]],
  );
});

test("the calendar shows repeating items on weekends too and marks class items", () => {
  const state = {
    blocks: [],
    plan: [],
    cancelled: [],
    personalEvents: [
      pe({ repeat: "weekly", date: "2026-11-08", calendar: "class" }),
    ],
  };
  const items = itemsForDate("2026-11-15", state, [], [], true);
  assert.equal(items.length, 1);
  const it = items[0];
  assert.ok(it.kind === "personal" && it.repeating && it.asClass);
});

test("dragging a series moves its weekdays and end date with it", () => {
  const p = pe({
    repeat: "custom",
    rule: { unit: "week", interval: 1, weekdays: [1, 3], until: "2026-12-01" },
  });
  const moved = shiftSeries(p, 1);
  assert.equal(moved.date, "2026-11-04");
  assert.deepEqual(moved.rule!.weekdays, [2, 4]);
  assert.equal(moved.rule!.until, "2026-12-02");
  // Sunday wraps to Monday.
  assert.deepEqual(
    shiftSeries(
      pe({
        repeat: "custom",
        rule: { unit: "week", interval: 1, weekdays: [6] },
      }),
      1,
    ).rule!.weekdays,
    [0],
  );
});

test("saved custom rules are validated on restore", () => {
  assert.equal(cleanRule({ unit: "week", interval: 0 }), null);
  assert.equal(cleanRule({ unit: "fortnight", interval: 1 }), null);
  assert.equal(cleanRule({ unit: "week", interval: 1, weekdays: [] }), null);
  assert.deepEqual(
    cleanRule({ unit: "week", interval: 2, weekdays: [3, 1, 1] }),
    {
      unit: "week",
      interval: 2,
      weekdays: [1, 3],
    },
  );
  const good = pe({
    id: "a",
    repeat: "custom",
    rule: { unit: "day", interval: 2 },
  });
  const bad = pe({ id: "b", repeat: "custom" });
  const old = pe({ id: "c", repeat: "weekly" });
  const json = JSON.stringify({ ...fresh(), personalEvents: [good, bad, old] });
  const mock = { getItem: () => json, setItem: () => {}, removeItem: () => {} };
  Object.defineProperty(globalThis, "localStorage", {
    value: mock,
    configurable: true,
  });
  try {
    assert.deepEqual(
      restore().personalEvents.map((p) => p.id),
      ["a", "c"],
    );
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
    });
  }
});

test("dialog save: a plain weekly class stays a busy-time block; anything else is a personal item", () => {
  const base = {
    id: "x",
    title: "Research Methods",
    date: "2026-11-03",
    start: 615,
    end: 735,
    preset: "weekly" as const,
    rule: null,
    location: "",
    calendar: "class" as const,
  };
  assert.deepEqual(savePayload(base, "x"), {
    block: { id: "x", title: "Research Methods", day: 1, start: 615, end: 735 },
    replaces: "x",
  });
  // Moving the class to Thursday via the Date field changes its weekday.
  assert.equal(savePayload({ ...base, date: "2026-11-05" }).block!.day, 3);
  // Every weekday, a location, a weekend date or Personal → PersonalEvent.
  const daily = savePayload({ ...base, preset: "weekdays" }, "x");
  assert.equal(daily.block, undefined);
  assert.equal(daily.personalEvent!.repeat, "weekdays");
  assert.equal(daily.personalEvent!.calendar, "class");
  assert.equal(daily.replaces, "x");
  assert.ok(savePayload({ ...base, location: "Room 2" }).personalEvent);
  assert.ok(savePayload({ ...base, date: "2026-11-07" }).personalEvent);
  const personal = savePayload({
    ...base,
    calendar: "personal",
  }).personalEvent!;
  assert.equal(personal.calendar, undefined);
  // A custom rule is stored with the item.
  const custom = savePayload({
    ...base,
    calendar: "personal",
    preset: "custom",
    rule: { unit: "week", interval: 2, weekdays: [1] },
  }).personalEvent!;
  assert.deepEqual(custom.rule, { unit: "week", interval: 2, weekdays: [1] });
});

test("dialog explains bad custom rules in plain words", () => {
  const d = "2026-11-03";
  assert.equal(
    ruleProblem({ unit: "week", interval: 1, weekdays: [] }, d),
    "Pick at least one day.",
  );
  assert.equal(
    ruleProblem({ unit: "day", interval: 0 }, d),
    "Repeat every 1 to 99.",
  );
  assert.equal(
    ruleProblem({ unit: "day", interval: NaN }, d),
    "Repeat every 1 to 99.",
  );
  assert.equal(
    ruleProblem({ unit: "day", interval: 1, until: "2026-11-01" }, d),
    "The end date must be on or after the start date.",
  );
  assert.equal(
    ruleProblem({ unit: "day", interval: 1, count: 500 }, d),
    "Choose 1 to 400 occurrences.",
  );
  assert.equal(ruleProblem({ unit: "day", interval: 1, count: 3 }, d), "");
});
