import { EVENTS } from "./data.ts";
import { overlap } from "./planner.ts";
import type { Block, Schedule } from "./types.ts";
/** Only newly introduced conflicts require Save confirmation; acknowledged conflicts remain saved. */
export function newBusyConflicts(
  state: Schedule,
  blocks: readonly Block[],
  buffer: number,
) {
  return EVENTS.filter(
    (e) => state.plan.includes(e.id) && !state.cancelled.includes(e.id),
  )
    .map((event) => ({
      event,
      blocks: blocks.filter(
        (block) =>
          overlap(event, block, buffer) &&
          !state.blocks.some(
            (old) =>
              old.id === block.id &&
              old.day === block.day &&
              old.start === block.start &&
              old.end === block.end &&
              overlap(event, old, state.buffer),
          ),
      ),
    }))
    .filter((conflict) => conflict.blocks.length > 0);
}
export function busyConflictWarning(
  conflicts: ReturnType<typeof newBusyConflicts>,
) {
  return (
    "Save these busy commitments despite conflicts with planned events?\n\n" +
    conflicts
      .map(
        ({ event, blocks }) =>
          `${event.title}: ${blocks.map((b) => b.title).join(", ")}`,
      )
      .join("\n") +
    "\n\nThe planned events and RSVP records will stay. Nothing will be removed, replaced or cancelled. Future suggestions will exclude this busy time. You can review or explicitly remove events from your calendar afterward."
  );
}
