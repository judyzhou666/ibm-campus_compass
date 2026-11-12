import { PlanningClarification, interpretRequest } from "./interpretation.ts";
import { requestPlan, planningKey, planModeLabel } from "./api.ts";
import { EVENTS, when } from "./data.ts";
import { issue } from "./planner.ts";
import { createStore, type DemoStore } from "./state.ts";
import type { CampusEvent, Constraints, DemoState } from "./types.ts";
import {
  replacementConstraints,
  constraintSummary,
  templateTradeOff,
  watsonxTradeOff,
  detectAvailabilityChange,
} from "./replanning.ts";
import { effectiveEvents } from "./updates.ts";

export function createConversation(
  demo: DemoStore,
  remove: (id: string) => void,
  fetcher = globalThis.fetch,
  /** Returns true when the backend is configured in watsonx mode. */
  isWatsonxMode: () => boolean = () => false,
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
    availabilityChangeSummary?: string,
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

      let response: string;
      if (old) {
        // Replacement flow: one alternative with explicit trade-off.
        const alternativeText = alternative
          ? buildAlternativeText(alternative, old, plan)
          : `No replacement satisfies the current filters: ${constraintSummary(plan.constraints)}. To explore alternatives, explicitly request a different day/time, food requirement, or topic in chat. Availability and eligibility checks will still apply. No alternative has been added.`;
        response = `"${old.title}" was unavailable (${snapshot.cancelled.includes(old.id) ? "cancelled in demo" : old.access === "full" ? "now full" : "moved into a conflict"}). I removed the unavailable entry and kept all your other calendar choices: ${retained}.\n\n${alternativeText}`;
      } else if (availabilityChangeSummary) {
        // Availability-change re-plan: show "what changed" summary.
        response = matches.length
          ? `${availabilityChangeSummary}\n\nI found ${matches.length} ${matches.length === 1 ? "option" : "options"} on your remaining available days. Each fits your current commitments${snapshot.buffer ? " with a 15-minute travel buffer" : ""}.\n\nView the details or add an event below. Events marked RSVP required need your confirmation first.`
          : `${availabilityChangeSummary}\n\nI couldn't find an eligible, conflict-free match for those days in this demo week. I haven't changed your calendar.\n\nTry a different day or interest, or say "start over" to clear all filters.`;
      } else {
        response = matches.length
          ? `I found ${matches.length} ${matches.length === 1 ? "option" : "options"} for your week. Each fits your current commitments${snapshot.buffer ? " with a 15-minute travel buffer" : ""}.\n\nView the details or add an event below. Events marked RSVP required need your confirmation first.`
          : `I couldn't find an eligible, conflict-free synthetic match for those constraints in this demo week. I haven't changed your calendar.\n\nTry a different day or interest, or say "start over" to clear time and food filters. Only Monday\u2013Friday events are available. Restricted, full, cancelled, and conflicting events are excluded.`;
      }
      if (plan.notice) response = plan.notice + "\n\n" + response;
      status.update((s) => ({
        ...s,
        mode: planModeLabel(plan),
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
        pending = error instanceof PlanningClarification ? error : undefined;
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

  /**
   * Build the alternative-event text with an explicit trade-off vs the lost event.
   * Uses watsonx evidence when available, template otherwise.
   */
  function buildAlternativeText(
    alternative: CampusEvent,
    lost: CampusEvent,
    plan: Awaited<ReturnType<typeof requestPlan>>,
  ): string {
    const evidenceItem = plan.evidence.find((e) => e.event_id === alternative.id);
    const isWatsonx = plan.mode === "watsonx" && plan.explanations === "watsonx";
    const tradeOffText =
      isWatsonx && evidenceItem
        ? watsonxTradeOff(alternative, lost, evidenceItem)
        : templateTradeOff(alternative, lost);
    const attributionLabel = isWatsonx && evidenceItem
      ? "Written by IBM watsonx (Granite)"
      : "Template evidence";
    return `An alternative is "${alternative.title}" on ${when(alternative)}. ${alternative.rsvp}. It's a suggestion only — add it if it works for you.\n\n${tradeOffText}\n\n[${attributionLabel}]`;
  }

  /**
   * Find a planned event that is now unavailable: cancelled, full by update, or moved into a conflict.
   * Returns the first such event from the plan, or undefined if none.
   */
  function findUnavailablePlanEvent(state: DemoState): CampusEvent | undefined {
    // First check explicitly cancelled-and-in-plan.
    const explicitlyCancelled = EVENTS.find(
      (e) => state.plan.includes(e.id) && state.cancelled.includes(e.id),
    );
    if (explicitlyCancelled) return explicitlyCancelled;
    // Then check time_moved events that are now in conflict.
    const eff = effectiveEvents(state.appliedUpdateIds);
    return eff.find(
      (e) =>
        state.plan.includes(e.id) &&
        !state.cancelled.includes(e.id) &&
        !!issue(e, state, eff),
    );
  }

  async function replace() {
    if (status.read().busy) return;
    const state = demo.read();
    const old = findUnavailablePlanEvent(state);
    if (!old) {
      assistant("There are no unavailable events in your plan.");
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
      let context = pending?.constraints;
      if (
        pending &&
        !(
          pending.clocks.length === 1 &&
          !pending.restatement &&
          /^(am|pm)[.!]?$/i.test(text)
        )
      ) {
        try {
          const reply = interpretRequest(text, {});
          const bounds = pending.clocks.map((clock) =>
            clock.startsWith("after")
              ? ("after" as const)
              : ("before" as const),
          );
          if (
            reply.clarification ||
            !reply.understood ||
            bounds.some((bound) => reply.constraints[bound] === undefined) ||
            (pending.restatement &&
              (!reply.constraints.topics?.length ||
                !reply.constraints.days?.length))
          ) {
            const clocks = [...pending.clocks];
            for (const match of text.matchAll(
              /\b(after|before)\s+\d+(?::\d+)?\s*(?:am|pm)?\b/gi,
            )) {
              const bound = match[1].toLowerCase() as "after" | "before";
              if (!clocks.some((clock) => clock.startsWith(bound)))
                clocks.push(match[0].toLowerCase());
            }
            const constraints = {
              ...pending.constraints,
              ...reply.constraints,
            };
            for (const clock of reply.clocks || [])
              delete constraints[
                clock.startsWith("after") ? "after" : "before"
              ];
            const restatement = pending.restatement || reply.restatement;
            if (restatement) delete constraints.days;
            pending = new PlanningClarification(
              pending.message,
              constraints,
              clocks,
              restatement,
            );
            demo.update((s) => ({
              ...s,
              messages: [...s.messages, { role: "user", text }],
            }));
            assistant(
              "Please restate the complete request with the topic, weekdays you CAN attend, and AM/PM for every time. No suggestions will be generated until every requirement is resolved.",
            );
            return;
          }
          if (pending.restatement) context = {};
        } catch (error) {
          assistant(
            error instanceof Error
              ? error.message
              : "Please restate the complete request.",
          );
          return;
        }
      }
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

      // Availability-change detection: "I'm busy Thursday", "I can't do Tuesday afternoon", etc.
      // Re-plan only the affected days; keep goal-type balance; show "what changed" summary.
      const availChange = detectAvailabilityChange(text);
      if (availChange && !pending) {
        const { busyDays, summary } = availChange;
        demo.update((s) => ({
          ...s,
          messages: [...s.messages, { role: "user", text }],
        }));
        await run((snapshot) => {
          // Keep all existing constraints, but restrict days to the remaining available days.
          const allDays = [0, 1, 2, 3, 4];
          const currentDays = snapshot.constraints.days ?? allDays;
          const remainingDays = currentDays.filter((d) => !busyDays.includes(d));
          // If no days remain, keep all (avoid an empty-days constraint that matches nothing).
          const newConstraints: Constraints = {
            ...snapshot.constraints,
            ...(remainingDays.length > 0 ? { days: remainingDays } : {}),
          };
          return requestPlan(
            "Find events",
            newConstraints,
            snapshot,
            fetcher,
            isWatsonxMode(),
          );
        }, undefined, summary);
        return;
      }

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
          isWatsonxMode(),
        ),
      );
    },
  };
}
