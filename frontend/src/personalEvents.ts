/**
 * busyBlocks — shared helper that converts state.blocks + state.personalEvents
 * into the combined list of Block-shaped busy times used everywhere conflict
 * checking happens.
 *
 * Only personal-event occurrences that fall on a demo-week date (Mon–Fri)
 * contribute to planning. Events outside the demo week are returned but only
 * affect planning if they land on a demo-week day (via weekly repeat).
 *
 * The result is capped at 100 to stay within the backend's validation limit.
 */
import { DEMO, weekDates } from "./config.ts";
import type { Block, DemoState, PersonalEvent } from "./types.ts";
import { isoToNoonUTC } from "./calendarGrid.ts";

/** 0-based weekday index (0=Mon…4=Fri) for an ISO date, or -1 for weekend. */
function weekdayOf(iso: string): number {
  const dow = isoToNoonUTC(iso).getUTCDay(); // 0=Sun
  if (dow === 0 || dow === 6) return -1;
  return dow - 1; // Mon=0 … Fri=4
}

/**
 * Return the ISO date of the demo-week occurrence of a weekly PersonalEvent,
 * or null if the event's weekday is not Mon–Fri.
 */
function weeklyDemoDate(pe: PersonalEvent, demoWeek: string[]): string | null {
  const wd = weekdayOf(pe.date);
  if (wd < 0 || wd >= 5) return null; // weekend
  return demoWeek[wd] ?? null;
}

/**
 * Return the demo-week ISO date for a PersonalEvent occurrence, or null if
 * the event does not land on any demo-week date.
 */
function demoWeekDate(pe: PersonalEvent, demoWeek: string[]): string | null {
  if (pe.repeat === "weekly") {
    return weeklyDemoDate(pe, demoWeek);
  }
  // One-off: only if the date itself is in the demo week
  return demoWeek.includes(pe.date) ? pe.date : null;
}

/**
 * Convert a PersonalEvent occurrence to a Block for conflict checking.
 * Returns null if the event does not land on a demo-week weekday.
 */
export function personalEventToBlock(
  pe: PersonalEvent,
  demoWeek?: string[],
): Block | null {
  const week = demoWeek ?? weekDates(DEMO);
  const iso = demoWeekDate(pe, week);
  if (!iso) return null;
  const day = week.indexOf(iso);
  if (day < 0 || day >= 5) return null;
  return { id: pe.id, title: pe.title, day, start: pe.start, end: pe.end };
}

/**
 * Combine state.blocks and state.personalEvents into one list of Blocks for
 * conflict checking against the demo week. Capped at 100.
 *
 * Use this everywhere state.blocks is currently used for conflict checking:
 *   - planner.ts issue()
 *   - planner.ts recommend()
 *   - api.ts schedulePayload (sent to the Rust backend)
 *   - updates.ts conflict detection
 *   - Pages.tsx profile busy-time overlap check
 *   - PlannerPanels.tsx "What I'm working with" list
 *   - components.tsx WeekStrip
 *   - CalendarView.tsx gridHours
 */
export function busyBlocks(
  state: Pick<DemoState, "blocks"> & { personalEvents?: DemoState["personalEvents"] },
  demoWeek?: string[],
): Block[] {
  const week = demoWeek ?? weekDates(DEMO);
  const fromPersonal: Block[] = (state.personalEvents ?? [])
    .map((pe) => personalEventToBlock(pe, week))
    .filter((b): b is Block => b !== null);
  return [...state.blocks, ...fromPersonal].slice(0, 100);
}
