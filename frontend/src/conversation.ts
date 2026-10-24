import { discoveryState } from "./discovery.ts";
import { preferenceSettingsKey } from "./preferences.ts";
import { PlanningClarification, interpretRequest } from "./interpretation.ts";
import { requestPlan, planningKey } from "./api.ts";
import { EVENTS, when } from "./data.ts";
import { issue } from "./planner.ts";
import { createStore, type DemoStore } from "./state.ts";
import type {
  CampusEvent,
  Constraints,
  DemoState,
  RecommendationMode,
} from "./types.ts";
import { replacementConstraints, constraintSummary } from "./replanning.ts";

export function createConversation(
  demo: DemoStore,
  remove: (id: string) => void,
  fetcher = globalThis.fetch,
) {
  const status = createStore({ busy: false, mode: "Simulated planner" });
  let version = 0;
  const sessionSkipped = new Set<string>();
  let pending: PlanningClarification | undefined;
  function invalidate() {
    version++;
    pending = undefined;
    sessionSkipped.clear();
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
      const plan = await task(discoveryState(snapshot, [...sessionSkipped]));
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
            plan:
              plan.constraints.mode === "discovery"
                ? latest.plan
                : [...latest.plan, ...matches.map((e) => e.id)],
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
        ? `“${old.title}” was cancelled in this simulation. I removed the cancelled entry and kept all your other calendar choices: ${retained}.\n\n${alternative ? `An alternative is “${alternative.title}” on ${when(alternative)}. Its ${alternative.topic.toLowerCase()} topic matches the replacement filters and has no conflict with the commitments you entered. ${alternative.rsvp}. It’s a suggestion only. Add it if it works for you.` : `No replacement satisfies the current filters: ${constraintSummary(plan.constraints)}. To explore alternatives, explicitly request a different day/time, food requirement, or topic in chat. Availability and eligibility checks will still apply. No alternative has been added.`}`
        : matches.length
          ? `I found ${matches.length} ${matches.length === 1 ? "option" : "options"} for your week. Each has no conflict with the commitments you entered${snapshot.buffer ? " with a 15-minute travel buffer" : ""}.\n\nView the details or add an event below. Events marked RSVP required need your confirmation first.`
          : "I couldn’t find an eligible, conflict-free synthetic match for those constraints in this demo week. I haven’t changed your calendar.\n\nTry a different day or interest, or say “start over” to clear time and food filters. Only Monday–Friday events are available. Restricted, full, cancelled, and conflicting events are excluded.";
      if (matches.length)
        response +=
          plan.constraints.mode === "discovery"
            ? "\n\nDiscovery alternatives: these are not a combined plan. Overlapping options cannot both be attended."
            : "\n\nPlan-building: these suggestions are mutually compatible with the selected travel buffer.";
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
            settingsKey: preferenceSettingsKey(snapshot),
            recommendationMode: plan.constraints.mode ?? "plan-building",
            matchReasons: plan.matchReasons.filter((r) =>
              matches.some((e) => e.id === r.event_id),
            ),
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
      return requestPlan(
        "Find events",
        { ...constraints, mode: "discovery" },
        snapshot,
        fetcher,
      );
    }, old);
  }

  return {
    read: status.read,
    subscribe: status.subscribe,
    replace,
    async refresh(
      mode: RecommendationMode = demo.read().constraints.mode ?? "discovery",
    ) {
      if (status.read().busy) return;
      pending = undefined;
      sessionSkipped.clear();
      await run((snapshot) =>
        requestPlan("Find events", { mode }, snapshot, fetcher),
      );
    },
    async another(id: string) {
      if (status.read().busy) return;
      if (EVENTS.some((e) => e.id === id)) sessionSkipped.add(id);
      pending = undefined;
      await run((snapshot) =>
        requestPlan(
          "Find events",
          { mode: "discovery", ...snapshot.constraints },
          snapshot,
          fetcher,
        ),
      );
    },
    reset() {
      invalidate();
      status.update(() => ({ busy: false, mode: "Simulated planner" }));
    },
    clear() {
      invalidate();
      demo.update((s) => ({ ...s, messages: [], constraints: {}, draft: [] }));
    },
    async chat(
      text: string,
      previous?: Constraints,
      exactTopics?: readonly string[],
    ) {
      if (status.read().busy || !text.trim()) return;
      text = text.trim();
      if (previous !== undefined || /\b(reset|start over)\b/i.test(text)) {
        pending = undefined;
        sessionSkipped.clear();
      }
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
      demo.update((s) => ({
        ...s,
        constraints: previous ?? s.constraints,
        messages: [...s.messages, { role: "user", text }],
      }));
      await run((snapshot) =>
        requestPlan(
          resolvedText,
          { mode: "discovery", ...(context ?? snapshot.constraints) },
          snapshot,
          fetcher,
          exactTopics,
        ),
      );
    },
  };
}
