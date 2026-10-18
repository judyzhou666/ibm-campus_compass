import { requestPlan, schedulePayload } from "./api.ts";
import { EVENTS, when } from "./data.ts";
import { issue } from "./planner.ts";
import { createStore, type DemoStore } from "./state.ts";
import type { CampusEvent, Constraints, DemoState } from "./types.ts";

const planningKey = (state: DemoState) =>
  JSON.stringify([schedulePayload(state), state.constraints]);
type Work = { plan: Awaited<ReturnType<typeof requestPlan>>; trade?: string };

export function createConversation(
  demo: DemoStore,
  remove: (id: string) => void,
  fetcher = globalThis.fetch,
) {
  const status = createStore({ busy: false, mode: "Simulated planner" });
  let version = 0;
  function invalidate() {
    version++;
    status.update((s) => ({ ...s, busy: false }));
  }
  function assistant(text: string) {
    demo.update((s) => ({
      ...s,
      messages: [...s.messages, { role: "assistant", text }],
    }));
  }

  async function run(
    task: (snapshot: DemoState, valid: () => boolean) => Promise<Work | null>,
    old?: CampusEvent,
  ) {
    const token = ++version;
    const snapshot = demo.read(),
      key = planningKey(snapshot);
    const valid = () => token === version && key === planningKey(demo.read());
    status.update((s) => ({ ...s, busy: true }));
    function stale() {
      if (token !== version) return true;
      if (key === planningKey(demo.read())) return false;
      assistant(
        old
          ? "Your schedule changed. The cancelled entry was removed; ask for another suggestion using your latest availability."
          : "Your schedule or preferences changed while I was planning. Please send your request again so I can use the latest details.",
      );
      return true;
    }
    try {
      const work = await task(snapshot, valid);
      if (stale() || !work) return;
      const { plan, trade = "" } = work;
      const matches: CampusEvent[] = [];
      for (const id of plan.ids) {
        const event = EVENTS.find((e) => e.id === id);
        const latest = demo.read();
        if (
          event &&
          !latest.plan.includes(id) &&
          !matches.some((e) => e.id === id) &&
          !issue(event, {
            ...latest,
            plan: [...latest.plan, ...matches.map((e) => e.id)],
          })
        )
          matches.push(event);
      }
      const alternative = matches[0];
      let response = old
        ? `“${old.title}” was cancelled in this simulation. I removed the cancelled entry and kept all your other calendar choices.\n\n${alternative ? `An alternative is “${alternative.title}” on ${when(alternative)}. It shares the ${old.topic.toLowerCase()} topic and fits your schedule. ${trade}\n\nIt’s a suggestion only. Add it if it works for you.` : "No eligible alternative in the same topic fits your current schedule. Try changing your availability or choosing another interest."}`
        : matches.length
          ? `I found ${matches.length} ${matches.length === 1 ? "option" : "options"} for your week. Each fits your current commitments${snapshot.buffer ? " with a 15-minute travel buffer" : ""}.\n\nView the details or add an event below. Events marked RSVP required need your confirmation first.`
          : "I couldn’t find a verified, conflict-free match for those constraints in this demo week. I haven’t changed your calendar.\n\nTry a different day or interest, or say “start over” to clear time and food filters. Only Monday–Friday events are available. Restricted, full, cancelled, and conflicting events are excluded.";
      if (plan.notice) response = plan.notice + "\n\n" + response;
      status.update((s) => ({
        ...s,
        mode:
          plan.source === "rust"
            ? "Rust planner · Simulated"
            : "Browser fallback · Simulated",
      }));
      demo.update((s) => ({
        ...s,
        constraints: old ? s.constraints : plan.constraints,
        draft: matches.map((e) => e.id),
        messages: [
          ...s.messages,
          {
            role: "assistant",
            text: response,
            eventIds: matches.map((e) => e.id),
          },
        ],
      }));
    } catch (error) {
      if (!stale())
        assistant(
          error instanceof Error
            ? error.message
            : "The planner could not finish. Try again.",
        );
    } finally {
      if (token === version) status.update((s) => ({ ...s, busy: false }));
    }
  }

  async function replace() {
    if (status.read().busy) return;
    const state = demo.read();
    const old = EVENTS.find(
      (e) => state.plan.includes(e.id) && state.cancelled.includes(e.id),
    );
    if (!old) {
      assistant("There are no cancelled events in your plan.");
      return;
    }
    remove(old.id);
    await run(async (snapshot, valid) => {
      const constraints = {
        ...snapshot.constraints,
        topics: [old.topic],
        limit: 1,
      };
      let plan = await requestPlan(
        "Find events",
        constraints,
        snapshot,
        fetcher,
      );
      if (!valid()) return null;
      let trade = "";
      if (!plan.ids.length) {
        const relaxed = { ...constraints };
        delete relaxed.days;
        delete relaxed.after;
        delete relaxed.before;
        plan = await requestPlan("Find events", relaxed, snapshot, fetcher);
        trade =
          "I relaxed your chat day/time filters to show a possible alternative; review the new time before adding it.";
      }
      return { plan, trade };
    }, old);
  }

  return {
    read: status.read,
    subscribe: status.subscribe,
    replace,
    reset() {
      invalidate();
      status.update(() => ({ busy: false, mode: "Simulated planner" }));
    },
    clear() {
      invalidate();
      demo.update((s) => ({ ...s, messages: [], constraints: {}, draft: [] }));
    },
    async chat(text: string, previous?: Constraints) {
      if (status.read().busy || !text.trim()) return;
      text = text.trim();
      if (
        /\b(cancelled|canceled|replacement|replan|re-plan)\b/i.test(text) &&
        demo.read().cancelled.some((id) => demo.read().plan.includes(id))
      )
        return replace();
      demo.update((s) => ({
        ...s,
        constraints: previous ?? s.constraints,
        messages: [...s.messages, { role: "user", text }],
      }));
      await run(async (snapshot) => ({
        plan: await requestPlan(text, snapshot.constraints, snapshot, fetcher),
      }));
    },
  };
}
