import { discoveryState } from "./discovery.ts";
import { readResolvedConstraints } from "./recommendationReasons.ts";
import { preferenceSettingsKey, practicalIssue, wirePreferences, activeTopics } from "./preferences.ts";
import { PlanningClarification, interpretRequest } from "./interpretation.ts";
import {
  requestPlan,
  planningKey,
  planModeLabel,
  LimitedDemoHint,
} from "./api.ts";
import { EVENTS, when } from "./data.ts";
import { issue, recommend, overlap } from "./planner.ts";
import { createStore, type DemoStore } from "./state.ts";
import type {
  CampusEvent,
  Constraints,
  DemoState,
  RecommendationMode,
  Message,
} from "./types.ts";
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
    availabilityChangeSummary?: string,
    /** When set, prepend this line to the result response (e.g. "Removed Thursday."). */
    replyPrefix?: string,
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
        const event = effectiveEvents(demo.read().appliedUpdateIds).find(
          (e) => e.id === id,
        );
        const latest = demo.read();
        if (
          event &&
          !latest.plan.includes(id) &&
          !matches.some((e) => e.id === id) &&
          !practicalIssue(event, latest) &&
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

      let response: string;
      let altIds: string[] = []; // alternative event IDs when nothing matched
      let overlapIds: string[] = []; // events that overlap with the conflict-free picks
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
      } else if (matches.length) {
        // Find eligible events that overlap the conflict-free picks (up to 3).
        overlapIds = findOverlapAlternatives(
          matches,
          plan.constraints,
          snapshot,
        );
        const overlapCount = overlapIds.length;
        const n = matches.length;
        const base =
          n === 1
            ? `I found 1 option${overlapCount > 0 ? ` that fits together, plus ${overlapCount} ${overlapCount === 1 ? "alternative" : "alternatives"} at the same time` : " for your week"}. It fits your current commitments${snapshot.buffer ? " with a 15-minute travel buffer" : ""}.`
            : `I found ${n} options${overlapCount > 0 ? ` that fit together, plus ${overlapCount} ${overlapCount === 1 ? "alternative" : "alternatives"} at the same time` : " for your week"}. Each fits your current commitments${snapshot.buffer ? " with a 15-minute travel buffer" : ""}.`;
        response = replyPrefix
          ? `${replyPrefix} ${base}\n\nView the details or add an event below. Events marked RSVP required need your confirmation first.`
          : `${base}\n\nView the details or add an event below. Events marked RSVP required need your confirmation first.`;
      } else {
        // Nothing matched. Use the Rust diagnostic when present (avoids duplicating the same
        // message from both Rust and the TypeScript fallback), otherwise build one here.
        const localAlt = buildNoMatchAlts(plan.constraints, discoveryState(snapshot,[...sessionSkipped]));
        altIds = localAlt.ids;
        if (plan.source === "rust" && plan.notice) {
          // Rust planner returned a no-match diagnostic — use it directly.
          response = plan.notice;
        } else if (plan.source === "browser-fallback" && plan.notice) {
          // Browser fallback unavailability notice + no-match explanation.
          response = plan.notice;
        } else {
          response = localAlt.text;
        }
      }
      // Only prepend plan.notice when it is a watsonx fallback or similar (not the diagnostic).
      // When plan.notice IS the diagnostic we've already assigned it as response above.
      if (plan.notice && matches.length)
        response = plan.notice + "\n\n" + response;
      if (matches.length)
        response +=
          plan.constraints.mode === "discovery"
            ? "\n\nDiscovery alternatives: these are not a combined plan. Overlapping options cannot both be attended."
            : "\n\nPlan-building: these suggestions are mutually compatible with the selected travel buffer.";
      status.update((s) => ({
        ...s,
        mode: planModeLabel(plan),
      }));
      demo.update((s) => ({
        ...s,
        constraints: old ? s.constraints : plan.constraints,
        // Only the conflict-free picks go into draft (shown in "Your draft plan").
        // altIds are shown inline in the message but not in the draft panel.
        draft: matches.map((e) => e.id),
        messages: [
          ...s.messages,
          {
            role: "assistant",
            text: response,
            eventIds: matches.map((e) => e.id),
            settingsKey: preferenceSettingsKey(snapshot),
            recommendationMode: plan.constraints.mode ?? "plan-building",
            resolvedConstraints: structuredClone(plan.constraints),
            matchReasons: plan.matchReasons.filter((r) =>
              matches.some((e) => e.id === r.event_id),
            ),
            overlapIds: overlapIds.length ? overlapIds : undefined,
            altIds: altIds.length ? altIds : undefined,
            evidence: plan.evidence.filter((item) =>
              matches.some((e) => e.id === item.event_id),
            ),
          },
        ],
      }));
    } catch (error) {
      if (!stale()) {
        pending = error instanceof PlanningClarification ? error : undefined;
        if (error instanceof LimitedDemoHint) {
          demo.update((s) => ({
            ...s,
            messages: [
              ...s.messages,
              {
                role: "assistant" as const,
                text: error.message,
                examples: error.examples,
              },
            ],
          }));
        } else {
          assistant(
            error instanceof Error
              ? error.message
              : "The planner could not finish. Try again.",
          );
        }
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
    const evidenceItem = plan.evidence.find(
      (e) => e.event_id === alternative.id,
    );
    const isWatsonx =
      plan.mode === "watsonx" && plan.explanations === "watsonx";
    const tradeOffText =
      isWatsonx && evidenceItem
        ? watsonxTradeOff(alternative, lost, evidenceItem)
        : templateTradeOff(alternative, lost);
    const attributionLabel =
      isWatsonx && evidenceItem
        ? "Written by IBM watsonx (Granite)"
        : "Template evidence";
    return `An alternative is "${alternative.title}" on ${when(alternative)}. ${alternative.rsvp}. It's a suggestion only — add it if it works for you.\n\n${tradeOffText}\n\n[${attributionLabel}]`;
  }

  /** Whether an event satisfies every filter, ignoring the student's schedule and availability. */
  function matchesFilters(e: CampusEvent, c: Constraints) {
    return (
      (!c.topics?.length || c.topics.includes(e.topic)) &&
      (!c.days || c.days.includes(e.day)) &&
      (c.after == null || e.start >= c.after) &&
      (c.before == null || e.end <= c.before) &&
      (!c.food || e.food === c.food) &&
      (!c.free || e.cost === 0) &&
      !c.excluded?.includes(e.topic)
    );
  }

  /**
   * Build a plain-language no-match message with IDs of alternative events to show as cards.
   * Relaxes one filter at a time and returns the first relaxation that yields results.
   */
  function buildNoMatchAlts(
    constraints: Constraints,
    snapshot: DemoState,
  ): { text: string; ids: string[] } {
    const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const n1 = (n: number) => (n === 1 ? "is 1 option" : `are ${n} options`);
    const topicStr = constraints.topics?.length
      ? constraints.topics.join(" or ") + " "
      : "";
    const dayStr =
      constraints.days?.length === 1
        ? ` on ${DAY_NAMES[constraints.days[0]] ?? "that day"}`
        : "";
    const timeStr =
      constraints.after !== undefined && constraints.after >= 1020
        ? " in the evening"
        : constraints.after !== undefined && constraints.after >= 720
          ? " in the afternoon"
          : constraints.before !== undefined && constraints.before <= 720
            ? " in the morning"
            : "";
    // When events match every filter but none can be recommended, the student's plan or
    // availability blocks them. Say so instead of claiming no events match.
    const blockedLead = EVENTS.some((e) => matchesFilters(e, constraints))
      ? `The matching ${topicStr}events${dayStr}${timeStr} are already in your plan, conflict with it, or aren't open.`
      : undefined;
    const say = (lead: string, tail: string) =>
      `${blockedLead ?? lead} ${tail}`;

    // 1. Drop food constraint and retry
    if (constraints.food) {
      const noFood = { ...constraints };
      delete noFood.food;
      const alt = recommend(snapshot, noFood, 4, true);
      if (alt.length) {
        const foodLabel =
          constraints.food === "Free meal"
            ? "free food"
            : constraints.food.toLowerCase();
        return {
          text: say(
            `No ${topicStr}events${dayStr}${timeStr} have ${foodLabel}.`,
            `Here ${n1(alt.length)} without the ${foodLabel} filter — tap one to see details.`,
          ),
          ids: alt.map((e) => e.id),
        };
      }
    }
    // 2. Drop free-admission constraint and retry
    if (constraints.free) {
      const noFree = { ...constraints };
      delete noFree.free;
      const alt = recommend(snapshot, noFree, 4, true);
      if (alt.length) {
        return {
          text: say(
            `No ${topicStr}events${dayStr}${timeStr} are free admission.`,
            `Here ${n1(alt.length)} including paid ones — tap one to see details.`,
          ),
          ids: alt.map((e) => e.id),
        };
      }
    }
    // 3. Drop day constraint and retry
    if (constraints.days?.length) {
      const noDay = { ...constraints };
      delete noDay.days;
      const alt = recommend(snapshot, noDay, 4, true);
      if (alt.length) {
        const dayNames = constraints.days
          .map((d) => DAY_NAMES[d])
          .filter(Boolean)
          .join("/");
        return {
          text: say(
            `No ${topicStr}events on ${dayNames || "that day"} match.`,
            `Here ${n1(alt.length)} on other days.`,
          ),
          ids: alt.map((e) => e.id),
        };
      }
    }
    // 4. Drop time constraint
    if (constraints.after !== undefined || constraints.before !== undefined) {
      const noTime = { ...constraints };
      delete noTime.after;
      delete noTime.before;
      const alt = recommend(snapshot, noTime, 4, true);
      if (alt.length) {
        return {
          text: say(
            `No ${topicStr}events match that time window.`,
            `Here ${n1(alt.length)} at other times.`,
          ),
          ids: alt.map((e) => e.id),
        };
      }
    }
    // 5. Drop topic constraint
    if (constraints.topics?.length) {
      const noTopic = { ...constraints };
      delete noTopic.topics;
      const alt = recommend(snapshot, noTopic, 4, true);
      if (alt.length) {
        return {
          text: say(
            `No ${topicStr}events fit the other filters.`,
            `Here ${n1(alt.length)} from other areas.`,
          ),
          ids: alt.map((e) => e.id),
        };
      }
    }
    return {
      text: say(
        "Nothing matched in this demo week.",
        `Try a different day, topic, or time, or say "start over" to clear all filters.`,
      ),
      ids: [],
    };
  }

  /**
   * Find eligible events that overlap with the conflict-free picks but weren't selected.
   * Returns up to 3 alternative event IDs.
   */
  function findOverlapAlternatives(
    picks: CampusEvent[],
    constraints: Constraints,
    snapshot: DemoState,
  ): string[] {
    const altIds: string[] = [];
    const prefs=wirePreferences(snapshot), active=activeTopics(snapshot,prefs);
    for (const e of effectiveEvents(snapshot.appliedUpdateIds)) {
      if (altIds.length >= 3) break;
      if (
        snapshot.plan.includes(e.id) ||
        picks.some((p) => p.id === e.id) ||
        issue(e, snapshot) || practicalIssue(e,snapshot,prefs) || prefs.dismissed.includes(e.id) || snapshot.view_excluded?.includes(e.id) || (constraints.explore && active.includes(e.topic)) ||
        !matchesFilters(e, constraints)
      )
        continue;
      // Include only if it overlaps at least one pick (that's why it was excluded).
      if (picks.some((p) => overlap(e, p, snapshot.buffer))) {
        altIds.push(e.id);
      }
    }
    return altIds;
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
      return requestPlan(
        "Find events",
        { ...constraints, mode: "plan-building" },
        snapshot,
        fetcher,
        undefined,
        true,
        isWatsonxMode(),
      );
    }, old);
  }

  return {
    read: status.read,
    subscribe: status.subscribe,
    replace,
    async refresh(mode?: RecommendationMode, message?: Message) {
      if (status.read().busy) return;
      const source =
        message ??
        [...demo.read().messages]
          .reverse()
          .find((m) => m.role === "assistant" && Array.isArray(m.eventIds));
      const constraints = readResolvedConstraints(source?.resolvedConstraints);
      if (!constraints) {
        assistant(
          "This older recommendation has no saved search filters. Please restate the complete search, including topic, days, times and practical requirements, so I can refresh it safely.",
        );
        return;
      }
      pending = undefined;
      sessionSkipped.clear();
      await run((snapshot) =>
        requestPlan(
          "Find events",
          {
            ...constraints,
            mode:
              mode ??
              source?.recommendationMode ??
              constraints.mode ??
              "plan-building",
          },
          snapshot,
          fetcher,
          undefined,
          true,
          isWatsonxMode(),
        ),
      );
    },
    async another(id: string) {
      if (status.read().busy) return;
      if (EVENTS.some((e) => e.id === id)) sessionSkipped.add(id);
      pending = undefined;
      await run((snapshot) =>
        requestPlan(
          "Find events",
          { mode: "plan-building", ...snapshot.constraints },
          snapshot,
          fetcher,
          undefined,
          true,
          isWatsonxMode(),
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
    /**
     * Remove a set of constraint keys and immediately re-run the search with the
     * remaining constraints, posting a short "Removed X. Here's what fits now:" prefix.
     */
    async removeFilter(
      removedLabel: string,
      updatedConstraints: Constraints,
      clearAll = false,
    ) {
      if (status.read().busy) return;
      // Update stored constraints first.
      demo.update((s) => ({ ...s, constraints: updatedConstraints }));
      if (clearAll) {
        demo.update((s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              role: "assistant" as const,
              text: "Filters cleared. Tell me what you're looking for.",
            },
          ],
        }));
        return;
      }
      // Re-run the search; the result message will start with "Removed <label>.".
      await run(
        (snapshot) =>
          requestPlan(
            "Find events",
            updatedConstraints,
            snapshot,
            fetcher,
            undefined,
            true,
            isWatsonxMode(),
          ),
        undefined,
        undefined,
        `Removed ${removedLabel}.`,
      );
    },
    async chat(
      text: string,
      previous?: Constraints,
      exactTopics?: readonly string[],
      continuation = false,
    ) {
      if (status.read().busy || !text.trim()) return;
      text = text.trim();
      if (previous !== undefined || /\b(reset|start over)\b/i.test(text)) {
        pending = undefined;
        sessionSkipped.clear();
      }
      if (
        pending &&
        /^(?:find|show|discover|browse|explore|build|create|plan)\b/i.test(text)
      ) {
        try {
          const fresh = interpretRequest(text);
          if (
            fresh.understood &&
            !fresh.clarification &&
            (fresh.constraints.topics?.length ||
              fresh.constraints.days?.length ||
              fresh.constraints.mode) &&
            fresh.constraints.after === undefined &&
            fresh.constraints.before === undefined
          )
            pending = undefined;
        } catch {
          /* Normal validation below reports unsupported new input. */
        }
      }
      const answeringClarification = !!pending;
      // Detect follow-up intent. Only carry over previous filters when the message
      // explicitly builds on the last search. Fresh questions start a new search.
      const isFollowUp =
        continuation ||
        answeringClarification ||
        previous !== undefined ||
        /^(?:after|before)\s+\d/i.test(text) ||
        /\b(only|also|instead|what about|and also|but|as well|too|more|another|different|except|without|rather|add|include|exclude)\b/i.test(
          text,
        ) ||
        /^(and |or |but )\b/i.test(text);
      if (!isFollowUp && !pending) sessionSkipped.clear();
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
        await run(
          (snapshot) => {
            // Keep all existing constraints, but restrict days to the remaining available days.
            const allDays = [0, 1, 2, 3, 4];
            const currentDays = snapshot.constraints.days ?? allDays;
            const remainingDays = currentDays.filter(
              (d) => !busyDays.includes(d),
            );
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
              undefined,
              true,
              isWatsonxMode(),
            );
          },
          undefined,
          summary,
        );
        return;
      }

      demo.update((s) => ({
        ...s,
        constraints: previous ?? (isFollowUp ? s.constraints : {}),
        messages: [...s.messages, { role: "user", text }],
      }));
      await run((snapshot) =>
        requestPlan(
          resolvedText,
          {
            mode: "plan-building",
            ...(context ?? (isFollowUp ? snapshot.constraints : {})),
          },
          snapshot,
          fetcher,
          exactTopics,
          continuation || answeringClarification,
          isWatsonxMode(),
        ),
      );
    },
  };
}
