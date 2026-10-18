import { enrollEvent } from "./api.ts";
import { EVENTS } from "./data.ts";
import { issue } from "./planner.ts";
import { createStore, type DemoStore } from "./state.ts";
import type { Rsvp } from "./types.ts";

export type EnrollmentOutcome =
  | { kind: "added"; notice: string }
  | { kind: "already-added" }
  | { kind: "rsvp" }
  | { kind: "rejected"; message: string }
  | { kind: "ignored" };

export function createEnrollment(demo: DemoStore, fetcher = globalThis.fetch) {
  const status = createStore<{ busy: boolean; rsvpEvent: string | null }>({
    busy: false,
    rsvpEvent: null,
  });
  let version = 0;
  let pending: string | null = null;

  function reset() {
    version++;
    pending = null;
    status.update(() => ({ busy: false, rsvpEvent: null }));
  }

  async function complete(id: string, rsvp?: Rsvp): Promise<EnrollmentOutcome> {
    if (status.read().busy) return { kind: "ignored" };
    const token = ++version;
    pending = id;
    status.update((s) => ({ ...s, busy: true }));
    try {
      const result = await enrollEvent(id, demo.read(), rsvp, fetcher);
      if (token !== version) return { kind: "ignored" };
      const event = EVENTS.find((e) => e.id === id)!;
      const problem = issue(event, demo.read());
      if (problem) throw new Error(problem);
      if (demo.read().plan.includes(id)) return { kind: "already-added" };
      demo.update((s) => ({
        ...s,
        plan: [...s.plan, id],
        rsvps: result.rsvpConfirmed
          ? [...s.rsvps.filter((x) => x !== id), id]
          : s.rsvps,
        draft: s.draft.filter((x) => x !== id),
      }));
      status.update((s) => ({ ...s, rsvpEvent: null }));
      return {
        kind: "added",
        notice:
          (result.rsvpConfirmed ? "Demo RSVP confirmed. " : "") +
          "Added to your calendar." +
          (result.notice ? " " + result.notice : ""),
      };
    } catch (error) {
      if (token !== version) return { kind: "ignored" };
      return {
        kind: "rejected",
        message:
          error instanceof Error
            ? error.message
            : "Could not add this event. Please try again.",
      };
    } finally {
      if (token === version) {
        pending = null;
        status.update((s) => ({ ...s, busy: false }));
      }
    }
  }

  return {
    read: status.read,
    subscribe: status.subscribe,
    reset,
    async choose(id: string): Promise<EnrollmentOutcome> {
      if (status.read().busy) return { kind: "ignored" };
      const event = EVENTS.find((e) => e.id === id);
      if (!event) return { kind: "rejected", message: "Unknown event." };
      if (demo.read().plan.includes(id)) return { kind: "already-added" };
      const problem = issue(event, demo.read());
      if (problem) return { kind: "rejected", message: problem };
      if (event.rsvp === "RSVP required") {
        status.update((s) => ({ ...s, rsvpEvent: id }));
        return { kind: "rsvp" };
      }
      return complete(id);
    },
    confirm(rsvp: Rsvp) {
      const id = status.read().rsvpEvent;
      return id
        ? complete(id, rsvp)
        : Promise.resolve<EnrollmentOutcome>({ kind: "ignored" });
    },
    cancel() {
      if (!status.read().busy)
        status.update((s) => ({ ...s, rsvpEvent: null }));
    },
    remove(id: string) {
      if (pending === id || status.read().rsvpEvent === id) reset();
      demo.update((s) => ({
        ...s,
        plan: s.plan.filter((x) => x !== id),
        rsvps: s.rsvps.filter((x) => x !== id),
      }));
    },
  };
}
