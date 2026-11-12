/**
 * Pure date-math helpers for CalendarView.
 * No React, no DOM, no side effects.
 */
import { DEMO, DEMO_NOW_MINUTE } from "./config.ts";
import type { DemoConfig } from "./config.ts";

export type CalView = "day" | "week" | "month" | "year";

/** Monday of the demo week as a UTC ISO date string ("2026-11-02"). */
export function demoWeekStart(c: DemoConfig = DEMO): string {
  return c.week_start;
}

/** The 5 demo-week ISO date strings (Mon–Fri). */
export function demoWeekDates(c: DemoConfig = DEMO): string[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(`${c.week_start}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** Demo "today" ISO date string (the Monday of the demo week). */
export function demoToday(c: DemoConfig = DEMO): string {
  return c.week_start;
}

/** Demo "now" minute-of-day. */
export function demoNowMinute(): number {
  return DEMO_NOW_MINUTE;
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

/** True if `iso` is within the demo week (Mon–Fri). */
export function isInDemoWeek(iso: string, c: DemoConfig = DEMO): boolean {
  return demoWeekDates(c).includes(iso);
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
  return demoWeekDates(c).indexOf(iso);
}
