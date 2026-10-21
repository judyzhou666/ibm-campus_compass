import { PlanningClarification } from "./interpretation.ts";
import { requestPlan, planningKey } from "./api.ts";
import { EVENTS, when } from "./data.ts";
import { issue } from "./planner.ts";
import { createStore, type DemoStore } from "./state.ts";
import type { CampusEvent, Constraints, DemoState } from "./types.ts";
import { replacementConstraints, constraintSummary } from "./replanning.ts";

export function createConversation(
  demo: DemoStore,
  remove: (id: string) => void,
  fetcher = globalThis.fetch,
) {
  const status = createStore({ busy: false, mode: "Simulated planner" });
  let version = 0;
  let pending: PlanningClarification | undefined;
  function invalidate() {
    version++;
    pending = undefined;
    status.update((s) => ({ ...s, busy: false }));
  }
  function assistant(text: string) {
    demo.update((s) => ({
      ...s,
      messages: [...s.messages, { role: "assistant", text }],
    }));
  }

  async function run(
    task: (snapshot: DemoState) => ReturnType<typeof requestPlan>,
    old?: CampusEvent,
  ) {
    const token = ++version;
    const snapshot = demo.read(),
      key = planningKey(snapshot);
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
      const plan = await task(snapshot);
      if (stale()) return;
      pending = undefined;
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
      const retained =
        snapshot.plan
          .map((id) => EVENTS.find((e) => e.id === id)?.title)
          .join(", ") || "none";
      let response = old
        ? `“${old.title}” was cancelled in this simulation. I removed the cancelled entry and kept all your other calendar choices: ${retained}.\n\n${alternative ? `An alternative is “${alternative.title}” on ${when(alternative)}. Its ${alternative.topic.toLowerCase()} topic matches the replacement filters and it fits your schedule. ${alternative.rsvp}. It’s a suggestion only. Add it if it works for you.` : `No replacement satisfies the current filters: ${constraintSummary(plan.constraints)}. To explore alternatives, explicitly request a different day/time, food requirement, or topic in chat. Availability and eligibility checks will still apply. No alternative has been added.`}`
        : matches.length
          ? `I found ${matches.length} ${matches.length === 1 ? "option" : "options"} for your week. Each fits your current commitments${snapshot.buffer ? " with a 15-minute travel buffer" : ""}.\n\nView the details or add an event below. Events marked RSVP required need your confirmation first.`
          : "I couldn’t find an eligible, conflict-free synthetic match for those constraints in this demo week. I haven’t changed your calendar.\n\nTry a different day or interest, or say “start over” to clear time and food filters. Only Monday–Friday events are available. Restricted, full, cancelled, and conflicting events are excluded.";
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
            evidence: plan.evidence.filter((item) =>
              matches.some((e) => e.id === item.event_id),
            ),
          },
        ],
      }));
    } catch (error) {
      if (!stale()) {
        pending =
          error instanceof PlanningClarification && error.clocks.length
            ? error
            : undefined;
        assistant(
          error instanceof Error
            ? error.message
            : "The planner could not finish. Try again.",
        );
      }
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
    pending = undefined;
    remove(old.id);
    await run((snapshot) => {
      const constraints = replacementConstraints(snapshot.constraints, old);
      return requestPlan("Find events", constraints, snapshot, fetcher);
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
      if (previous !== undefined || /\b(reset|start over)\b/i.test(text))
        pending = undefined;
      let resolvedText = text;
      const context = pending?.constraints;
      if (pending && /^(am|pm)[.!]?$/i.test(text)) {
        if (pending.clocks.length !== 1) {
          assistant(
            "Please restate the complete request with AM/PM for each time.",
          );
          return;
        }
        resolvedText = `${pending.clocks[0]} ${text.replace(/[.!]/g, "")}`;
      }

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
      await run((snapshot) =>
        requestPlan(
          resolvedText,
          context ?? snapshot.constraints,
          snapshot,
          fetcher,
        ),
      );
    },
  };
}
