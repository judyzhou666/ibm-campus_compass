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
import { occursOn } from "./recurrence.ts";

/**
 * Every demo-week weekday (Mon–Fri) on which a PersonalEvent occurs, as Blocks
 * for conflict checking. Daily or "every weekday" items give several blocks.
 */
export function personalEventBlocks(pe: PersonalEvent, demoWeek?: string[]): Block[] {
  const week = (demoWeek ?? weekDates(DEMO)).slice(0, 5);
  const days = week
    .map((iso, day) => (occursOn(pe, iso) ? day : -1))
    .filter((day) => day >= 0);
  return days.map((day) => ({
    id: days.length === 1 ? pe.id : `${pe.id}:${day}`,
    title: pe.title,
    day,
    start: pe.start,
    end: pe.end,
  }));
}

/**
 * The first demo-week occurrence of a PersonalEvent as a Block, or null if it
 * does not land on a demo-week weekday.
 */
export function personalEventToBlock(
  pe: PersonalEvent,
  demoWeek?: string[],
): Block | null {
  return personalEventBlocks(pe, demoWeek)[0] ?? null;
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
    .flatMap((pe) => personalEventBlocks(pe, week));
  return [...state.blocks, ...fromPersonal].slice(0, 100);
}
