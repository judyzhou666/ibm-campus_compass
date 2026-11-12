/**
 * Synthetic update loop for the Campus Compass demo.
 *
 * Loads data/updates.json (embedded at build time via Vite ?raw import),
 * applies the next unapplied batch to browser-local demo state, and derives
 * display information for the Briefing panel and bell menu.
 *
 * All changes are purely local; no server call is made for the update itself.
 * The applied update IDs are sent to /api/plan so the backend can treat
 * cancelled/full events as unavailable.
 */

import type { DemoState, EventUpdate, UpdateBatch } from "./types.ts";
import updatesJson from "../../data/updates.json";

export const ALL_BATCHES: UpdateBatch[] = updatesJson as UpdateBatch[];

/** All individual updates in order. */
export const ALL_UPDATES: EventUpdate[] = ALL_BATCHES.flatMap(
  (b) => b.updates,
);

/**
 * Returns the IDs of unapplied updates given the set of already-applied IDs.
 */
export function pendingUpdates(appliedIds: string[]): EventUpdate[] {
  return ALL_UPDATES.filter((u) => !appliedIds.includes(u.id));
}

/**
 * Returns the next batch to apply (the batch whose updates are all still
 * pending), or null if every batch has been fully applied.
 */
export function nextBatch(appliedIds: string[]): UpdateBatch | null {
  return (
    ALL_BATCHES.find((b) =>
      b.updates.some((u) => !appliedIds.includes(u.id)),
    ) ?? null
  );
}

/**
 * Apply the next batch of updates to the demo state.
 *
 * - cancelled: adds the event_id to state.cancelled
 * - full:      marks the event as full (tracked in appliedUpdateIds; planner
 *              excludes it via the /api/plan applied_update_ids field)
 * - time_moved: records the update (time changes are validated server-side and
 *               shown as "Needs confirmation" because local event data is immutable)
 * - room_changed: recorded in appliedUpdateIds only (display shows new_location)
 *
 * Returns the new state and the list of updates that were applied.
 */
export function applyNextBatch(state: DemoState): {
  nextState: DemoState;
  applied: EventUpdate[];
  batch: UpdateBatch | null;
} {
  const batch = nextBatch(state.appliedUpdateIds);
  if (!batch) return { nextState: state, applied: [], batch: null };

  const newApplied = [...state.appliedUpdateIds];
  let newCancelled = [...state.cancelled];

  for (const u of batch.updates) {
    if (newApplied.includes(u.id)) continue;
    newApplied.push(u.id);
    if (u.kind === "cancelled" && !newCancelled.includes(u.event_id)) {
      newCancelled = [...newCancelled, u.event_id];
    }
  }

  return {
    nextState: {
      ...state,
      cancelled: newCancelled,
      appliedUpdateIds: newApplied,
      lastUpdateCheck: new Date().toISOString(),
    },
    applied: batch.updates,
    batch,
  };
}

/**
 * Returns all updates that have been applied (across all batches so far).
 */
export function appliedUpdates(appliedIds: string[]): EventUpdate[] {
  return ALL_UPDATES.filter((u) => appliedIds.includes(u.id));
}

/**
 * Returns the updates that were applied since the previous check.
 * "Since last check" means updates in the most-recently applied batch.
 */
export function updatesInLatestBatch(appliedIds: string[]): {
  batch: UpdateBatch | null;
  updates: EventUpdate[];
} {
  // Find the last batch that has at least one applied update.
  const lastApplied = [...ALL_BATCHES]
    .reverse()
    .find((b) => b.updates.some((u) => appliedIds.includes(u.id)));
  if (!lastApplied) return { batch: null, updates: [] };
  return {
    batch: lastApplied,
    updates: lastApplied.updates.filter((u) => appliedIds.includes(u.id)),
  };
}

/**
 * True when this event_id has conflicting notices in the applied updates
 * (e.g., one "cancelled" and one "room_changed" for the same event).
 */
export function hasConflict(eventId: string, appliedIds: string[]): boolean {
  const relevant = ALL_UPDATES.filter(
    (u) => u.event_id === eventId && appliedIds.includes(u.id),
  );
  const kinds = new Set(relevant.map((u) => u.kind));
  // Conflict = at least two different kinds for the same event.
  return relevant.length > 1 && kinds.size > 1;
}

/**
 * Returns the effective update for an event_id from the applied set,
 * or null if none applies.  For conflicting events, returns null (caller
 * should use hasConflict to show "Needs confirmation" instead).
 */
export function effectiveUpdate(
  eventId: string,
  appliedIds: string[],
): EventUpdate | null {
  const relevant = ALL_UPDATES.filter(
    (u) => u.event_id === eventId && appliedIds.includes(u.id),
  );
  if (relevant.length === 0) return null;
  if (relevant.length > 1) {
    // Conflicting notices — don't pick one; signal "needs confirmation" instead.
    const kinds = new Set(relevant.map((u) => u.kind));
    if (kinds.size > 1) return null;
  }
  return relevant[relevant.length - 1];
}

/** Returns a badge label for an event in the update context: "Needs confirmation", "Updated", or null. */
export function updateBadge(
  eventId: string,
  appliedIds: string[],
): "needs-confirmation" | "updated" | null {
  if (!appliedIds.some((id) => ALL_UPDATES.some((u) => u.id === id && u.event_id === eventId))) {
    return null;
  }
  if (hasConflict(eventId, appliedIds)) return "needs-confirmation";
  return "updated";
}

/**
 * Human-readable label for an update kind.
 */
export function kindLabel(kind: EventUpdate["kind"]): string {
  switch (kind) {
    case "cancelled":
      return "Cancelled";
    case "full":
      return "Now full";
    case "time_moved":
      return "Time moved";
    case "room_changed":
      return "Room changed";
  }
}

/**
 * Returns a relative-time string for an ISO timestamp, e.g. "2 hours ago",
 * "just now", "3 days ago".
 */
export function relativeTime(isoTimestamp: string): string {
  const then = new Date(isoTimestamp).getTime();
  const now = Date.now();
  const diff = Math.floor((now - then) / 1000); // seconds
  if (diff < 0) return "just now";
  if (diff < 60) return "just now";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} ${m === 1 ? "minute" : "minutes"} ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  const d = Math.floor(diff / 86400);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

/**
 * Returns true when the event is effectively cancelled or full in the current
 * applied-update state (blocking enrollment/planning).
 */
export function isUnavailableByUpdate(
  eventId: string,
  appliedIds: string[],
): boolean {
  const relevant = ALL_UPDATES.filter(
    (u) => u.event_id === eventId && appliedIds.includes(u.id),
  );
  // Even if there's a conflict, a cancelled/full notice still makes it unavailable.
  return relevant.some((u) => u.kind === "cancelled" || u.kind === "full");
}
