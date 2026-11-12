/**
 * Pure date-math helpers for CalendarView.
 * No React, no DOM, no side effects.
 */
import { DEMO, demoTodayIndex, weekDates } from "./config.ts";
import type { DemoConfig } from "./config.ts";
import type { CampusEvent, DemoState } from "./types.ts";

export type CalView = "day" | "week" | "month" | "year";
export const CAL_VIEWS: readonly CalView[] = ["day", "week", "month", "year"];

/**
 * The demo-week date that counts as "today" in the viewer's time zone, using
 * the same rule as the Dashboard strip and page heading (`demoTodayIndex`).
 * Returns null when the demo clock falls outside Monday–Friday there.
 */
export function todayIso(zone: string, c: DemoConfig = DEMO): string | null {
  const i = demoTodayIndex(zone, c);
  return i >= 0 ? weekDates(c)[i] : null;
}

/** Return a Date object at noon UTC for a given ISO date string. */
export function isoToNoonUTC(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/** Return ISO date string (YYYY-MM-DD) for a Date at noon UTC. */
export function noonUTCToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add `days` to an ISO date string, returning a new ISO date string. */
export function addDays(iso: string, days: number): string {
  const d = isoToNoonUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return noonUTCToIso(d);
}

/** Monday (start) of the ISO-week that contains `iso`. */
export function weekMonday(iso: string): string {
  const d = isoToNoonUTC(iso);
  // UTC day: 0 = Sunday, 1 = Monday…
  const dow = d.getUTCDay(); // 0–6
  const offsetToMon = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offsetToMon);
  return noonUTCToIso(d);
}

/** Seven ISO date strings for the week containing `iso` (Mon–Sun). */
export function weekDatesFor(iso: string): string[] {
  const mon = weekMonday(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/** ISO date string for the first day of the month containing `iso`. */
export function monthStart(iso: string): string {
  return iso.slice(0, 7) + "-01";
}

/** ISO date string for the first day of the next month. */
export function nextMonthStart(iso: string): string {
  const d = isoToNoonUTC(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return noonUTCToIso(d);
}

/** ISO date string for the first day of the previous month. */
export function prevMonthStart(iso: string): string {
  const d = isoToNoonUTC(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return noonUTCToIso(d);
}

/**
 * All ISO date strings for a month-grid view (Monday-first, full weeks).
 * May include dates from the previous/next month to fill the grid.
 */
export function monthGridDates(iso: string): string[] {
  const start = monthStart(iso);
  const end = nextMonthStart(iso);
  const gridStart = weekMonday(start);
  // collect until we've passed the end and completed the last week
  const dates: string[] = [];
  let cur = gridStart;
  while (cur < end || dates.length % 7 !== 0) {
    dates.push(cur);
    cur = addDays(cur, 1);
    if (dates.length > 42) break; // safety cap 6 weeks
  }
  return dates;
}

/** Twelve ISO month-start strings for the year containing `iso`. */
export function yearMonthStarts(iso: string): string[] {
  const year = iso.slice(0, 4);
  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    return `${year}-${m}-01`;
  });
}

/**
 * Compute the "anchor" ISO date for prev/next navigation given the current
 * anchor and view. For week/day, moves by 7 or 1 day. For month, moves by
 * one month. For year, moves by one year.
 */
export function navigate(
  anchor: string,
  view: CalView,
  direction: 1 | -1,
): string {
  switch (view) {
    case "day":
      return addDays(anchor, direction);
    case "week":
      return addDays(anchor, direction * 7);
    case "month":
      return direction === 1 ? nextMonthStart(anchor) : prevMonthStart(anchor);
    case "year": {
      const year = parseInt(anchor.slice(0, 4), 10) + direction;
      return `${year}-01-01`;
    }
  }
}

/** Title string for the toolbar given the view and anchor date. */
export function viewTitle(anchor: string, view: CalView): string {
  switch (view) {
    case "day": {
      const d = isoToNoonUTC(anchor);
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(d);
    }
    case "week": {
      const mon = weekMonday(anchor);
      const sun = addDays(mon, 6);
      const dMon = isoToNoonUTC(mon);
      const dSun = isoToNoonUTC(sun);
      const sameMonth = dMon.getUTCMonth() === dSun.getUTCMonth();
      const sameYear = dMon.getUTCFullYear() === dSun.getUTCFullYear();
      const monStr = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(dMon);
      const sunStr = new Intl.DateTimeFormat("en-US", {
        month: sameMonth ? undefined : "short",
        day: "numeric",
        year: sameYear ? undefined : "numeric",
        timeZone: "UTC",
      }).format(dSun);
      const year = dSun.getUTCFullYear();
      return `${monStr} – ${sunStr}, ${year}`;
    }
    case "month": {
      const d = isoToNoonUTC(monthStart(anchor));
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(d);
    }
    case "year":
      return anchor.slice(0, 4);
  }
}

/**
 * For a time-grid view, compute the top percentage offset and height
 * percentage of an item within the grid.
 *
 * @param startMin  - start time in minutes after midnight
 * @param endMin    - end time in minutes after midnight
 * @param gridStart - first hour shown (inclusive), e.g. 8
 * @param gridEnd   - last hour shown (exclusive), e.g. 21
 * @returns { top, height } as percentage strings
 */
export function itemPosition(
  startMin: number,
  endMin: number,
  gridStart = 8,
  gridEnd = 21,
): { top: string; height: string } {
  const totalMin = (gridEnd - gridStart) * 60;
  const clampedStart = Math.max(startMin, gridStart * 60);
  const clampedEnd = Math.min(endMin, gridEnd * 60);
  const top = ((clampedStart - gridStart * 60) / totalMin) * 100;
  const height = Math.max(((clampedEnd - clampedStart) / totalMin) * 100, 1.5);
  return {
    top: `${top.toFixed(3)}%`,
    height: `${height.toFixed(3)}%`,
  };
}

/**
 * Group overlapping items into columns so they can be placed side-by-side.
 * Items are assumed to be from the same day.
 * Returns an array of { item, col, totalCols }.
 */
export function layoutColumns<T extends { start: number; end: number }>(
  items: T[],
): Array<{ item: T; col: number; totalCols: number }> {
  if (items.length === 0) return [];

  // Sort by start, then by duration desc
  const sorted = [...items].sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start),
  );

  // Groups of overlapping items
  const groups: T[][] = [];
  for (const item of sorted) {
    let placed = false;
    for (const group of groups) {
      if (group.some((g) => g.start < item.end && item.start < g.end)) {
        group.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([item]);
  }

  const result: Array<{ item: T; col: number; totalCols: number }> = [];
  for (const group of groups) {
    const cols: T[][] = [];
    for (const item of group) {
      let placed = false;
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        if (!col.some((g) => g.start < item.end && item.start < g.end)) {
          col.push(item);
          result.push({ item, col: c, totalCols: 0 }); // totalCols filled below
          placed = true;
          break;
        }
      }
      if (!placed) {
        cols.push([item]);
        result.push({ item, col: cols.length - 1, totalCols: 0 });
      }
    }
    const totalCols = cols.length;
    for (const r of result) {
      if (group.includes(r.item)) r.totalCols = totalCols;
    }
  }
  return result;
}

/** True if `iso` is a weekday (Mon–Fri). */
export function isWeekday(iso: string): boolean {
  const d = isoToNoonUTC(iso);
  const dow = d.getUTCDay();
  return dow >= 1 && dow <= 5;
}

/** 0-based weekday index (0=Mon…6=Sun) for an ISO date string. */
export function isoWeekdayIndex(iso: string): number {
  const d = isoToNoonUTC(iso);
  const dow = d.getUTCDay(); // 0=Sun
  return dow === 0 ? 6 : dow - 1;
}

/** For a weekday ISO date, the 0-based demo-week day (0=Mon…4=Fri), or -1. */
export function demoDayIndex(iso: string, c: DemoConfig = DEMO): number {
  return weekDates(c).indexOf(iso);
}

/** Sort an array of items with a `start` field ascending by start time. Pure. */
export function sortByStart<T extends { start: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.start - b.start);
}

/**
 * Hours the time grid must show so that every item fits: the earliest full
 * hour at or before any start and the first full hour at or after any end,
 * never narrower than `minStart`–`minEnd` (8 AM–9 PM by default).
 */
export function gridHours(
  items: ReadonlyArray<{ start: number; end: number }>,
  minStart = 8,
  minEnd = 21,
): { start: number; end: number } {
  let start = minStart;
  let end = minEnd;
  for (const it of items) {
    if (!(it.end > it.start)) continue;
    start = Math.min(start, Math.floor(it.start / 60));
    end = Math.max(end, Math.ceil(it.end / 60));
  }
  return { start: Math.max(0, start), end: Math.min(24, end) };
}

/** True when an item lies fully inside the grid (nothing would be clipped). */
export function fitsGrid(
  item: { start: number; end: number },
  grid: { start: number; end: number },
): boolean {
  return item.start >= grid.start * 60 && item.end <= grid.end * 60;
}

export type CalendarItem =
  | { kind: "class"; id: string; title: string; day: number; start: number; end: number }
  | {
      kind: "event";
      id: string;
      title: string;
      day: number;
      start: number;
      end: number;
      cancelled: boolean;
      /** A time_moved update changed this event's start or end. */
      moved: boolean;
    }
  | {
      kind: "personal";
      id: string;
      title: string;
      day: number;
      start: number;
      end: number;
      location?: string;
      /** True for weekly-repeating items */
      weekly: boolean;
    };

/**
 * Items for one date. Chosen events use the effective (update-applied) times
 * from `events` and appear only on their demo-week date; busy classes repeat
 * weekly on their weekday when `includeClasses` is true (Day/Week view).
 * Personal events (from state.personalEvents) are included when present.
 */
export function itemsForDate(
  iso: string,
  state: Pick<DemoState, "blocks" | "plan" | "cancelled"> & { personalEvents?: DemoState["personalEvents"] },
  events: readonly CampusEvent[],
  original: readonly CampusEvent[],
  includeClasses: boolean,
): CalendarItem[] {
  const items: CalendarItem[] = [];
  const wd = isoWeekdayIndex(iso);
  if (includeClasses) {
    if (wd < 5) {
      for (const b of state.blocks) {
        if (b.day === wd) items.push({ kind: "class", ...b });
      }
    }
  }
  // Personal events: one-off on this exact date, or weekly on this weekday
  for (const pe of state.personalEvents ?? []) {
    let onThisDate = false;
    if (pe.repeat === "none") {
      onThisDate = pe.date === iso;
    } else if (pe.repeat === "weekly" && wd < 5) {
      // weekly: matches if the same weekday (compare weekday of pe.date to wd)
      const peWd = (() => {
        const d = isoToNoonUTC(pe.date).getUTCDay();
        return d === 0 ? 6 : d - 1;
      })();
      onThisDate = peWd === wd;
    }
    if (onThisDate) {
      items.push({
        kind: "personal",
        id: pe.id,
        title: pe.title,
        day: wd,
        start: pe.start,
        end: pe.end,
        location: pe.location,
        weekly: pe.repeat === "weekly",
      });
    }
  }
  const dayIdx = demoDayIndex(iso);
  if (dayIdx >= 0) {
    for (const e of events) {
      if (e.day !== dayIdx || !state.plan.includes(e.id)) continue;
      const o = original.find((x) => x.id === e.id);
      items.push({
        kind: "event",
        id: e.id,
        title: e.title,
        day: e.day,
        start: e.start,
        end: e.end,
        cancelled: state.cancelled.includes(e.id),
        moved: !!o && (o.start !== e.start || o.end !== e.end),
      });
    }
  }
  return sortByStart(items);
}

/**
 * Short tag for a planner `issue()` reason on a chosen event, or null when
 * nothing needs attention. Cancellation has its own style, so it is ignored.
 */
export function attentionTag(reason: string | null): string | null {
  if (!reason || reason === "Cancelled in demo") return null;
  if (reason.startsWith("Conflicts with")) return "Conflict";
  if (reason === "Event is full") return "Full";
  return "Check";
}

/** Parse a saved {view, anchor}; anything invalid falls back to Week + `fallbackAnchor`. */
export function parseSavedPosition(
  raw: string | null | undefined,
  fallbackAnchor: string,
): { view: CalView; anchor: string } {
  const fallback = { view: "week" as CalView, anchor: fallbackAnchor };
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as { view?: unknown; anchor?: unknown };
    const view = CAL_VIEWS.includes(v.view as CalView) ? (v.view as CalView) : null;
    const anchor = typeof v.anchor === "string" ? v.anchor : "";
    const valid =
      /^\d{4}-\d{2}-\d{2}$/.test(anchor) &&
      noonUTCToIsoSafe(anchor) === anchor &&
      Math.abs(+anchor.slice(0, 4) - +fallbackAnchor.slice(0, 4)) <= 50;
    return view && valid ? { view, anchor } : fallback;
  } catch {
    return fallback;
  }
}

// ── Drag helpers (pure, no DOM) ────────────────────────────────────────────

/**
 * Convert a pixel offset from the top of the time grid to a minute value,
 * snapped to 15-minute intervals.
 *
 * @param pixelY   - pixels from top of the grid area
 * @param gridH    - total height of the grid area in pixels
 * @param gridStart - first hour displayed (inclusive)
 * @param gridEnd   - last hour displayed (exclusive)
 */
export function pixelToMins(
  pixelY: number,
  gridH: number,
  gridStart: number,
  gridEnd: number,
): number {
  const totalMin = (gridEnd - gridStart) * 60;
  const raw = (pixelY / gridH) * totalMin + gridStart * 60;
  return Math.round(raw / 15) * 15;
}

/**
 * Clamp a start time so the event fits within the grid and has at least
 * `minDuration` minutes.
 */
export function clampStart(
  start: number,
  duration: number,
  gridStart: number,
  gridEnd: number,
  minDuration = 15,
): number {
  const dur = Math.max(duration, minDuration);
  const lo = gridStart * 60;
  const hi = gridEnd * 60 - dur;
  return Math.max(lo, Math.min(hi, start));
}

/**
 * Clamp an end time so it is at least `minDuration` minutes after `start`
 * and does not exceed `gridEnd`.
 */
export function clampEnd(
  end: number,
  start: number,
  gridEnd: number,
  minDuration = 15,
): number {
  return Math.min(gridEnd * 60, Math.max(start + minDuration, end));
}

/**
 * True when dropping a block (from state.blocks) on a weekend day is
 * disallowed.
 */
export function blockDropAllowed(targetIso: string): boolean {
  return isWeekday(targetIso);
}

function noonUTCToIsoSafe(iso: string): string | null {
  const d = isoToNoonUTC(iso);
  return Number.isFinite(+d) ? noonUTCToIso(d) : null;
}
