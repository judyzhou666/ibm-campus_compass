import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  weekMonday,
  weekDatesFor,
  monthStart,
  nextMonthStart,
  prevMonthStart,
  monthGridDates,
  yearMonthStarts,
  navigate,
  viewTitle,
  itemPosition,
  layoutColumns,
  isWeekday,
  isoWeekdayIndex,
  demoDayIndex,
  sortByStart,
  todayIso,
  gridHours,
  fitsGrid,
  itemsForDate,
  attentionTag,
  parseSavedPosition,
} from "../frontend/src/calendarGrid.ts";
import { weekDates } from "../frontend/src/config.ts";
import { DEFAULT_BLOCKS, EVENTS } from "../frontend/src/data.ts";
import { effectiveEvents } from "../frontend/src/updates.ts";
import { issue } from "../frontend/src/planner.ts";
import { calendarText } from "../frontend/src/calendar.ts";
import { utcStamp } from "../frontend/src/config.ts";
import { fresh } from "../frontend/src/state.ts";

test("addDays moves forward and backward correctly", () => {
  assert.equal(addDays("2026-11-02", 1), "2026-11-03");
  assert.equal(addDays("2026-11-02", 7), "2026-11-09");
  assert.equal(addDays("2026-11-02", -1), "2026-11-01");
  // month boundary
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  // year boundary
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("weekMonday returns Monday for any day in the week", () => {
  // 2026-11-02 is already a Monday
  assert.equal(weekMonday("2026-11-02"), "2026-11-02");
  // 2026-11-04 is Wednesday → Monday is 2026-11-02
  assert.equal(weekMonday("2026-11-04"), "2026-11-02");
  // 2026-11-08 is Sunday → Monday is 2026-11-02
  assert.equal(weekMonday("2026-11-08"), "2026-11-02");
  // 2026-11-09 is Monday
  assert.equal(weekMonday("2026-11-09"), "2026-11-09");
});

test("weekDatesFor returns 7 days Mon-Sun", () => {
  const dates = weekDatesFor("2026-11-04"); // Wednesday
  assert.equal(dates.length, 7);
  assert.equal(dates[0], "2026-11-02"); // Monday
  assert.equal(dates[6], "2026-11-08"); // Sunday
});

test("monthStart returns first day of month", () => {
  assert.equal(monthStart("2026-11-02"), "2026-11-01");
  assert.equal(monthStart("2026-11-30"), "2026-11-01");
  assert.equal(monthStart("2026-01-15"), "2026-01-01");
});

test("nextMonthStart moves to first of next month", () => {
  assert.equal(nextMonthStart("2026-11-01"), "2026-12-01");
  assert.equal(nextMonthStart("2026-12-01"), "2027-01-01");
});

test("prevMonthStart moves to first of previous month", () => {
  assert.equal(prevMonthStart("2026-11-01"), "2026-10-01");
  assert.equal(prevMonthStart("2026-01-01"), "2025-12-01");
});

test("monthGridDates produces a Monday-first grid with complete weeks", () => {
  const dates = monthGridDates("2026-11-01");
  // All rows must be complete weeks (multiple of 7)
  assert.equal(dates.length % 7, 0);
  // First date must be a Monday (isoWeekdayIndex 0)
  assert.equal(isoWeekdayIndex(dates[0]), 0);
  // November 1 must be included
  assert.ok(dates.includes("2026-11-01"));
  // November 30 must be included
  assert.ok(dates.includes("2026-11-30"));
});

test("yearMonthStarts returns 12 months for the year", () => {
  const months = yearMonthStarts("2026-11-02");
  assert.equal(months.length, 12);
  assert.equal(months[0], "2026-01-01");
  assert.equal(months[11], "2026-12-01");
});

test("navigate moves correctly in each view", () => {
  // Day
  assert.equal(navigate("2026-11-02", "day", 1), "2026-11-03");
  assert.equal(navigate("2026-11-02", "day", -1), "2026-11-01");
  // Week
  assert.equal(navigate("2026-11-02", "week", 1), "2026-11-09");
  assert.equal(navigate("2026-11-02", "week", -1), "2026-10-26");
  // Month
  assert.equal(navigate("2026-11-02", "month", 1), "2026-12-01");
  assert.equal(navigate("2026-11-02", "month", -1), "2026-10-01");
  // Year
  assert.equal(navigate("2026-11-02", "year", 1), "2027-01-01");
  assert.equal(navigate("2026-11-02", "year", -1), "2025-01-01");
});

test("viewTitle produces correct strings", () => {
  // Day
  assert.equal(viewTitle("2026-11-02", "day"), "Monday, Nov 2, 2026");
  // Week
  const weekTitle = viewTitle("2026-11-04", "week");
  assert.ok(weekTitle.includes("Nov 2"), `Week title: ${weekTitle}`);
  assert.ok(weekTitle.includes("2026"), `Week title missing year: ${weekTitle}`);
  // Month
  assert.equal(viewTitle("2026-11-02", "month"), "November 2026");
  // Year
  assert.equal(viewTitle("2026-11-02", "year"), "2026");
});

test("itemPosition computes correct percentages for 8AM-9PM grid", () => {
  // 8:00 AM = 480 min; 9:00 AM = 540 min; grid 8–21 = 780 min
  const item = itemPosition(480, 540);
  assert.equal(item.top, "0.000%");
  const expectedH = ((60 / 780) * 100).toFixed(3) + "%";
  assert.equal(item.height, expectedH);

  // Item at end of grid: 8 PM (1200) to 9 PM (1260)
  const late = itemPosition(1200, 1260);
  const expectedTop = (((1200 - 480) / 780) * 100).toFixed(3) + "%";
  assert.equal(late.top, expectedTop);
});

test("itemPosition clamps items outside the grid", () => {
  // Start before grid start
  const early = itemPosition(300, 540);
  assert.equal(early.top, "0.000%");
  // End after grid end
  const late = itemPosition(1200, 1440);
  const { height } = itemPosition(1200, 21 * 60);
  assert.equal(late.height, height);
});

test("layoutColumns assigns non-overlapping items to the same column", () => {
  const items = [
    { start: 600, end: 720 },
    { start: 750, end: 900 },
  ];
  const layout = layoutColumns(items);
  assert.equal(layout.length, 2);
  assert.equal(layout[0].col, 0);
  assert.equal(layout[1].col, 0);
  assert.equal(layout[0].totalCols, 1);
});

test("layoutColumns splits overlapping items into separate columns", () => {
  const items = [
    { start: 600, end: 720 },
    { start: 660, end: 780 },
  ];
  const layout = layoutColumns(items);
  const cols = layout.map((l) => l.col);
  assert.ok(cols.includes(0));
  assert.ok(cols.includes(1));
  assert.equal(layout[0].totalCols, 2);
  assert.equal(layout[1].totalCols, 2);
});

test("layoutColumns handles 3-way overlapping items", () => {
  const items = [
    { start: 600, end: 720 },
    { start: 610, end: 730 },
    { start: 620, end: 740 },
  ];
  const layout = layoutColumns(items);
  const cols = new Set(layout.map((l) => l.col));
  assert.equal(cols.size, 3);
  assert.equal(layout[0].totalCols, 3);
});

test("isWeekday returns true for Mon-Fri only", () => {
  assert.equal(isWeekday("2026-11-02"), true);  // Monday
  assert.equal(isWeekday("2026-11-06"), true);  // Friday
  assert.equal(isWeekday("2026-11-07"), false); // Saturday
  assert.equal(isWeekday("2026-11-08"), false); // Sunday
});

test("isoWeekdayIndex returns 0 for Monday through 6 for Sunday", () => {
  assert.equal(isoWeekdayIndex("2026-11-02"), 0); // Monday
  assert.equal(isoWeekdayIndex("2026-11-03"), 1); // Tuesday
  assert.equal(isoWeekdayIndex("2026-11-06"), 4); // Friday
  assert.equal(isoWeekdayIndex("2026-11-07"), 5); // Saturday
  assert.equal(isoWeekdayIndex("2026-11-08"), 6); // Sunday
});

test("demoDayIndex returns 0-4 for demo week weekdays", () => {
  assert.equal(demoDayIndex("2026-11-02"), 0); // Monday
  assert.equal(demoDayIndex("2026-11-03"), 1); // Tuesday
  assert.equal(demoDayIndex("2026-11-06"), 4); // Friday
  assert.equal(demoDayIndex("2026-11-07"), -1); // Saturday (not in demo week)
  assert.equal(demoDayIndex("2026-11-09"), -1); // next Monday
});

test("sortByStart returns items in ascending start order", () => {
  const items = [
    { id: "c", start: 780, end: 840 },
    { id: "a", start: 540, end: 600 },
    { id: "b", start: 720, end: 780 },
  ];
  const sorted = sortByStart(items);
  assert.equal(sorted[0].id, "a");
  assert.equal(sorted[1].id, "b");
  assert.equal(sorted[2].id, "c");
  // original array not mutated
  assert.equal(items[0].id, "c");
});

test("sortByStart preserves order for equal start times", () => {
  const items = [
    { id: "x", start: 600, end: 660 },
    { id: "y", start: 600, end: 720 },
  ];
  const sorted = sortByStart(items);
  assert.equal(sorted.length, 2);
  assert.equal(sorted[0].start, 600);
  assert.equal(sorted[1].start, 600);
});

// ── Review fixes (PR #12) ──────────────────────────────────────────────────

test("todayIso follows the chosen time zone like the Dashboard strip", () => {
  assert.equal(todayIso("America/New_York"), "2026-11-02");
  assert.equal(todayIso("Asia/Tokyo"), "2026-11-02"); // Monday 11 PM there
  assert.equal(todayIso("Pacific/Auckland"), "2026-11-03"); // already Tuesday
  assert.deepEqual(weekDates().length, 5);
});

test("gridHours keeps 8 AM–9 PM when everything fits", () => {
  assert.deepEqual(gridHours([{ start: 600, end: 720 }]), { start: 8, end: 21 });
  assert.deepEqual(gridHours([]), { start: 8, end: 21 });
});

test("gridHours extends to 10 PM for an item ending at 22:00", () => {
  assert.deepEqual(gridHours([{ start: 1200, end: 1320 }]), { start: 8, end: 22 });
});

test("gridHours extends to 7 AM for an item starting at 7:00", () => {
  assert.deepEqual(gridHours([{ start: 420, end: 470 }]), { start: 7, end: 21 });
});

test("gridHours rounds partial hours outward and ignores empty items", () => {
  assert.deepEqual(gridHours([{ start: 450, end: 1290 }]), { start: 7, end: 22 });
  assert.deepEqual(gridHours([{ start: 300, end: 300 }]), { start: 8, end: 21 });
});

test("every catalog event and default busy time fits the computed grid", () => {
  const grid = gridHours([...EVENTS, ...DEFAULT_BLOCKS]);
  for (const item of [...EVENTS, ...DEFAULT_BLOCKS]) {
    assert.ok(fitsGrid(item, grid), `${item.title} ${item.start}-${item.end} is outside ${grid.start}-${grid.end}`);
  }
});

test("itemsForDate uses moved times from applied updates and flags them", () => {
  const state = { blocks: [], plan: ["e1"], cancelled: [] };
  const before = itemsForDate("2026-11-03", state, EVENTS, EVENTS, false);
  const after = itemsForDate("2026-11-03", state, effectiveEvents(["u3"]), EVENTS, false);
  assert.equal(before[0].start, 900);
  assert.equal(after[0].start, 630);
  assert.equal(after[0].end, 720);
  assert.equal(after[0].kind === "event" && after[0].moved, true);
  assert.equal(before[0].kind === "event" && before[0].moved, false);
});

test("itemsForDate repeats classes weekly but keeps events on the demo week", () => {
  const state = { blocks: [{ id: "b", title: "Class", day: 1, start: 600, end: 660 }], plan: ["e1"], cancelled: [] };
  const nextTue = itemsForDate("2026-11-10", state, EVENTS, EVENTS, true);
  assert.deepEqual(nextTue.map((i) => i.kind), ["class"]);
  assert.deepEqual(itemsForDate("2026-11-03", state, EVENTS, EVENTS, false).map((i) => i.id), ["e1"]);
});

test("a moved event that overlaps a class is tagged Conflict; back-to-back is not", () => {
  const events = effectiveEvents(["u3"]);
  const e1 = events.find((e) => e.id === "e1")!;
  const base = { plan: ["e1"], cancelled: [], interests: [], buffer: 0, appliedUpdateIds: ["u3"] };
  const clash = issue(e1, { ...base, blocks: [{ id: "b", title: "Research Methods", day: 1, start: 600, end: 720 }] }, events);
  assert.equal(attentionTag(clash), "Conflict");
  const backToBack = issue(e1, { ...base, blocks: [{ id: "b", title: "Seminar", day: 1, start: 720, end: 780 }] }, events);
  assert.equal(attentionTag(backToBack), null);
});

test("attentionTag ignores cancellation and labels other issues", () => {
  assert.equal(attentionTag(null), null);
  assert.equal(attentionTag("Cancelled in demo"), null);
  assert.equal(attentionTag("Event is full"), "Full");
  assert.equal(attentionTag("Membership not verified"), "Check");
});

test("parseSavedPosition restores a valid view and date", () => {
  assert.deepEqual(parseSavedPosition('{"view":"month","anchor":"2026-12-01"}', "2026-11-02"), {
    view: "month",
    anchor: "2026-12-01",
  });
});

test("parseSavedPosition falls back to Week and today for missing or invalid values", () => {
  const fallback = { view: "week", anchor: "2026-11-02" };
  assert.deepEqual(parseSavedPosition(null, "2026-11-02"), fallback);
  assert.deepEqual(parseSavedPosition("not json", "2026-11-02"), fallback);
  assert.deepEqual(parseSavedPosition('{"view":"agenda","anchor":"2026-12-01"}', "2026-11-02"), fallback);
  assert.deepEqual(parseSavedPosition('{"view":"day","anchor":"2026-02-30"}', "2026-11-02"), fallback);
  assert.deepEqual(parseSavedPosition('{"view":"day","anchor":"1726-02-01"}', "2026-11-02"), fallback);
});

test("calendar export uses moved times and changed rooms from applied updates", () => {
  const text = calendarText({ ...fresh(), plan: ["e1", "e9"], cancelled: [], appliedUpdateIds: ["u3", "u4"] })!;
  assert.ok(text.includes(`DTSTART:${utcStamp(1, 630)}`), "moved start");
  assert.ok(text.includes(`DTEND:${utcStamp(1, 720)}`), "moved end");
  assert.ok(!text.includes(`DTSTART:${utcStamp(1, 900)}`), "old start is gone");
  assert.ok(text.includes("LOCATION:Innovation Hub\\, Room 3"), "changed room");
});
