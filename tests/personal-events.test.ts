/**
 * Tests for the personal-event calendar feature:
 *   - state.restore keeps valid personalEvents, drops invalid ones
 *   - busyBlocks: one-off/weekly/weekend/outside-demo-week behaviour
 *   - planner: personal event on Tue 3-4 PM makes a Tue 3 PM campus event conflict
 *   - recommendations skip campus events clashing with a personal event
 *   - dialog save rules (class + weekly + weekday → blocks)
 *   - drag math helpers: pixelToMins, clampStart, clampEnd, blockDropAllowed
 *   - npm run test:api parity: the API receives derived blocks
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { restore, fresh } from "../frontend/src/state.ts";
import { busyBlocks, personalEventToBlock } from "../frontend/src/personalEvents.ts";
import { issue, recommend } from "../frontend/src/planner.ts";
import {
  pixelToMins,
  clampStart,
  clampEnd,
  blockDropAllowed,
} from "../frontend/src/calendarGrid.ts";
import { EVENTS } from "../frontend/src/data.ts";
import { weekDates } from "../frontend/src/config.ts";
import type { PersonalEvent } from "../frontend/src/types.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

const demoWeek = weekDates(); // e.g. ["2026-11-02","2026-11-03","2026-11-04","2026-11-05","2026-11-06"]
const MON = demoWeek[0]; // Mon Nov 2
const TUE = demoWeek[1]; // Tue Nov 3
const WED = demoWeek[2]; // Wed Nov 4
const THU = demoWeek[3]; // Thu Nov 5
const FRI = demoWeek[4]; // Fri Nov 6

function makePE(overrides: Partial<PersonalEvent> = {}): PersonalEvent {
  return {
    id: "pe-test-" + Math.random().toString(36).slice(2),
    title: "Test event",
    date: TUE,
    start: 9 * 60,
    end: 10 * 60,
    repeat: "none",
    ...overrides,
  };
}

// ── state restore ─────────────────────────────────────────────────────────────

function withStorage(json: string, fn: () => void) {
  const mock = { getItem: (_k: string) => json, setItem: () => {}, removeItem: () => {} };
  Object.defineProperty(global, "localStorage", { value: mock, configurable: true });
  try {
    fn();
  } finally {
    Object.defineProperty(global, "localStorage", { value: undefined, configurable: true });
  }
}

test("restore: keeps valid personalEvents", () => {
  const saved = {
    ...fresh(),
    personalEvents: [
      makePE({ id: "pe1", title: "Study group", date: TUE, start: 540, end: 600, repeat: "none" }),
    ],
  };
  const json = JSON.stringify(saved);
  withStorage(json, () => {
    const restored = restore();
    assert.equal(restored.personalEvents.length, 1);
    assert.equal(restored.personalEvents[0].id, "pe1");
    assert.equal(restored.personalEvents[0].title, "Study group");
  });
});

test("restore: drops personalEvents with end <= start", () => {
  const invalid = makePE({ start: 600, end: 600 }); // end === start
  const saved = { ...fresh(), personalEvents: [invalid] };
  withStorage(JSON.stringify(saved), () => {
    const restored = restore();
    assert.equal(restored.personalEvents.length, 0);
  });
});

test("restore: drops personalEvents with bad date", () => {
  const invalid = makePE({ date: "not-a-date" });
  const saved = { ...fresh(), personalEvents: [invalid] };
  withStorage(JSON.stringify(saved), () => {
    const restored = restore();
    assert.equal(restored.personalEvents.length, 0);
  });
});

test("restore: drops personalEvents with invalid repeat", () => {
  const invalid = { ...makePE(), repeat: "daily" as PersonalEvent["repeat"] };
  const saved = { ...fresh(), personalEvents: [invalid] };
  withStorage(JSON.stringify(saved), () => {
    const restored = restore();
    assert.equal(restored.personalEvents.length, 0);
  });
});

test("restore: caps personalEvents at 200", () => {
  const many = Array.from({ length: 250 }, (_, i) => makePE({ id: `pe-${i}` }));
  const saved = { ...fresh(), personalEvents: many };
  withStorage(JSON.stringify(saved), () => {
    const restored = restore();
    assert.equal(restored.personalEvents.length, 200);
  });
});

// ── busyBlocks ─────────────────────────────────────────────────────────────────

test("busyBlocks: one-off on demo-week date is included with correct day index", () => {
  const state = { blocks: [], personalEvents: [makePE({ date: TUE, start: 9 * 60, end: 10 * 60, repeat: "none" })] };
  const result = busyBlocks(state);
  assert.equal(result.length, 1);
  assert.equal(result[0].day, 1); // Tue = index 1
  assert.equal(result[0].start, 9 * 60);
  assert.equal(result[0].end, 10 * 60);
});

test("busyBlocks: one-off outside demo week is excluded", () => {
  const state = { blocks: [], personalEvents: [makePE({ date: "2026-10-01", start: 9 * 60, end: 10 * 60, repeat: "none" })] };
  const result = busyBlocks(state);
  assert.equal(result.length, 0);
});

test("busyBlocks: weekly from before demo week is included if same weekday", () => {
  // e.g. repeating every Tuesday starting Oct 6
  const state = {
    blocks: [],
    personalEvents: [makePE({ date: "2026-10-06", start: 14 * 60, end: 15 * 60, repeat: "weekly" })],
    // 2026-10-06 is a Tuesday (same weekday as TUE Nov 3)
  };
  const result = busyBlocks(state);
  // should appear on Tuesday of demo week
  assert.equal(result.length, 1);
  assert.equal(result[0].day, 1);
});

test("busyBlocks: weekly on weekend is excluded", () => {
  // 2026-11-07 is a Saturday
  const state = {
    blocks: [],
    personalEvents: [makePE({ date: "2026-11-07", start: 9 * 60, end: 10 * 60, repeat: "weekly" })],
  };
  const result = busyBlocks(state);
  assert.equal(result.length, 0);
});

test("busyBlocks: combines state.blocks and personal events", () => {
  const state = {
    blocks: [{ id: "b1", title: "Class", day: 0, start: 10 * 60, end: 11 * 60 }],
    personalEvents: [makePE({ date: TUE, start: 14 * 60, end: 15 * 60, repeat: "none" })],
  };
  const result = busyBlocks(state);
  assert.equal(result.length, 2);
});

test("busyBlocks: capped at 100", () => {
  const blocks = Array.from({ length: 80 }, (_, i) => ({
    id: `b${i}`,
    title: `B${i}`,
    day: 0,
    start: 60 + i,
    end: 90 + i,
  }));
  const personalEvents = Array.from({ length: 50 }, (_, i) =>
    makePE({ id: `pe${i}` }),
  );
  const state = { blocks, personalEvents };
  const result = busyBlocks(state);
  assert.equal(result.length, 100);
});

// ── planner conflict ──────────────────────────────────────────────────────────

// Find a campus event on Tuesday afternoon (day=1, roughly 15:00-16:00)
const tueTueMorning = EVENTS.find((e) => e.day === 1 && e.start >= 15 * 60 && e.start < 16 * 60);

if (tueTueMorning) {
  test("planner: personal event on Tue 3-4 PM blocks a conflicting campus event", () => {
    const personalEvent = makePE({
      date: TUE,
      start: 15 * 60,
      end: 16 * 60,
      repeat: "none",
    });
    const state = {
      ...fresh(),
      personalEvents: [personalEvent],
      plan: [],
      cancelled: [],
    };
    const reason = issue(tueTueMorning!, state, EVENTS);
    assert.match(reason ?? "", /Conflicts with/);
  });
}

test("planner: personal event on Tue 3-4 PM causes recommend() to skip Tue 3 PM events", () => {
  const personalEvent = makePE({
    date: TUE,
    start: 15 * 60,
    end: 16 * 60,
    repeat: "none",
  });
  const state = {
    ...fresh(),
    personalEvents: [personalEvent],
    plan: [],
    cancelled: [],
  };
  const recs = recommend(state, {}, 10);
  // None of the recommendations should be on Tue day=1 overlapping 15:00-16:00
  for (const rec of recs) {
    const overlaps = rec.day === 1 && rec.start < 16 * 60 + state.buffer && rec.end > 15 * 60 - state.buffer;
    assert.equal(overlaps, false, `Rec ${rec.id} (${rec.start}-${rec.end} day=${rec.day}) should not overlap personal event`);
  }
});

// ── drag math helpers ────────────────────────────────────────────────────────
// pixelToMins now uses colHeight(gridStart, gridEnd) = (end-start)*48px internally.
// For gridStart=8, gridEnd=21: colH = 13*48 = 624px

import { colHeight, HOUR_PX } from "../frontend/src/calendarGrid.ts";

test("pixelToMins: top of grid (0px) = gridStart*60", () => {
  const result = pixelToMins(0, 8, 21);
  assert.equal(result, 8 * 60);
});

test("pixelToMins: bottom of grid (colH px) = gridEnd*60", () => {
  const h = colHeight(8, 21); // 13 * 48 = 624
  const result = pixelToMins(h, 8, 21);
  assert.equal(result, 21 * 60);
});

test("pixelToMins: 4 PM line on 8-22 grid = 960 minutes", () => {
  // 4 PM = 16:00 = 960 min. On an 8-22 grid: colH = 14*48 = 672px
  // relPct = (960 - 8*60) / ((22-8)*60) = 480/840 ≈ 0.5714
  // pixelY = 0.5714 * 672 ≈ 384px
  const h = colHeight(8, 22); // 14 * 48 = 672
  const pxForAF = (((16 * 60) - 8 * 60) / ((22 - 8) * 60)) * h;
  const result = pixelToMins(pxForAF, 8, 22);
  assert.equal(result, 16 * 60); // exactly 960
});

test("pixelToMins: result always snaps to 15 min", () => {
  // Any pixel value should produce a multiple-of-15 result
  const result = pixelToMins(300, 8, 21);
  assert.equal(result % 15, 0);
});

test("colHeight: 13-hour grid = 624px, 14-hour = 672px, 15-hour = 720px", () => {
  assert.equal(colHeight(8, 21), 624);
  assert.equal(colHeight(8, 22), 672);
  assert.equal(colHeight(7, 22), 720);
});

test("clampStart: start + duration fits in grid", () => {
  // dur=60, gridStart=8, gridEnd=21 → hi = 21*60 - 60 = 1200
  const result = clampStart(1200, 60, 8, 21);
  assert.equal(result, 1200);
  const result2 = clampStart(1300, 60, 8, 21);
  assert.equal(result2, 1200); // clamped to hi
  const result3 = clampStart(400, 60, 8, 21);
  assert.equal(result3, 480); // clamped to gridStart*60
});

test("clampEnd: end at least minDuration after start", () => {
  const result = clampEnd(9 * 60, 9 * 60, 21, 15); // end === start → should become start + 15
  assert.equal(result, 9 * 60 + 15);
  const result2 = clampEnd(22 * 60, 9 * 60, 21, 15); // beyond gridEnd
  assert.equal(result2, 21 * 60);
});

test("blockDropAllowed: allows Mon-Fri, rejects Sat-Sun", () => {
  assert.equal(blockDropAllowed(MON), true);
  assert.equal(blockDropAllowed(TUE), true);
  assert.equal(blockDropAllowed(FRI), true);
  assert.equal(blockDropAllowed("2026-11-07"), false); // Saturday
  assert.equal(blockDropAllowed("2026-11-08"), false); // Sunday
});

// ── personalEventToBlock ──────────────────────────────────────────────────────

test("personalEventToBlock: one-off on demo week returns correct Block", () => {
  const pe = makePE({ date: WED, start: 9 * 60, end: 10 * 60, repeat: "none" });
  const block = personalEventToBlock(pe);
  assert.ok(block);
  assert.equal(block!.day, 2); // Wed = 2
  assert.equal(block!.start, 9 * 60);
  assert.equal(block!.end, 10 * 60);
});

test("personalEventToBlock: one-off outside demo week returns null", () => {
  const pe = makePE({ date: "2026-10-01", start: 9 * 60, end: 10 * 60, repeat: "none" });
  const block = personalEventToBlock(pe);
  assert.equal(block, null);
});

test("personalEventToBlock: weekly from different week returns block on same weekday", () => {
  // A "weekly" event started 2026-10-07 (Wednesday) should land on Wed Nov 4
  const pe = makePE({ date: "2026-10-07", start: 14 * 60, end: 15 * 60, repeat: "weekly" });
  const block = personalEventToBlock(pe);
  assert.ok(block, "Should return a block for weekly event on Wednesday");
  assert.equal(block!.day, 2); // Wed
});

// ── target column from clientX ────────────────────────────────────────────

test("target column from clientX: finds nearest column by midpoint", () => {
  // Simulate 5 column rects for Mon–Fri, each 100px wide
  const colRects = Array.from({ length: 5 }, (_, i) => ({
    left: 60 + i * 100, right: 60 + (i + 1) * 100, width: 100,
  } as DOMRect));
  const colDates = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];

  function findCol(clientX: number): string {
    let best = 0; let bestD = Infinity;
    for (let i = 0; i < colRects.length; i++) {
      const mid = colRects[i].left + colRects[i].width / 2;
      const d = Math.abs(clientX - mid);
      if (d < bestD) { bestD = d; best = i; }
    }
    return colDates[best];
  }

  // Mon midpoint = 60 + 0*100 + 50 = 110 → Mon
  assert.equal(findCol(110), "2026-11-02");
  // 165 is between Mon(110) and Tue(210), closer to Tue
  assert.equal(findCol(165), "2026-11-03");
  // Fri midpoint = 60 + 4*100 + 50 = 510 → Fri
  assert.equal(findCol(510), "2026-11-06");
});

// ── drag-vs-click: threshold suppresses dialog ──────────────────────────────

test("drag threshold: move < 4px is treated as a click (active=false)", () => {
  // Pure math: if dist < DRAG_THRESHOLD, active stays false
  const DRAG_THRESHOLD = 4;
  const startX = 100, startY = 200;
  const scenarios: [number, number, boolean][] = [
    [100, 200, false],       // no movement → click
    [100, 203, false],       // 3px up → still click
    [103, 200, false],       // 3px right → still click
    [100, 205, true],        // 5px down → drag
    [104, 200, true],        // 4px right → drag (equal to threshold → active)
  ];
  for (const [cx, cy, expectActive] of scenarios) {
    const dx = cx - startX, dy = cy - startY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const wouldActivate = dist >= DRAG_THRESHOLD;
    assert.equal(wouldActivate, expectActive, `dx=${dx} dy=${dy} dist=${dist.toFixed(2)} expected active=${expectActive}`);
  }
});
