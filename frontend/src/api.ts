import type {
  Schedule,
  Constraints,
  DemoState,
  PlanResponse,
  Rsvp,
} from "./types.ts";
import { EVENTS } from "./data.ts";
import { recommend, issue } from "./planner.ts";
import {
  PlanningClarification,
  interpretRequest,
  validateConstraints,
} from "./interpretation.ts";
import { isUnavailableByUpdate, effectiveEvents } from "./updates.ts";

export const schedulePayload = (state: DemoState | Schedule) => {
  const s = state as DemoState;
  const appliedUpdateIds: string[] = s.appliedUpdateIds ?? [];
  return {
    plan: [...state.plan],
    cancelled: [...state.cancelled],
    interests: [...state.interests],
    buffer: state.buffer,
    preferred_time: state.preferred_time || "any",
    blocks: state.blocks.map(({ title, day, start, end }) => ({
      title,
      day,
      start,
      end,
    })),
    applied_update_ids: appliedUpdateIds,
  };
};

/** Profile context sent to the Rust planner for watsonx ranking (no name, no history). */
export const profilePayload = (state: DemoState) => ({
  major: state.major || "",
  goals: state.goals || "",
  goal_types: state.goal_types || [],
});

export const planningKey = (state: DemoState) =>
  JSON.stringify([schedulePayload(state), state.constraints]);

class InputError extends Error {}

async function post(
  path: string,
  body: unknown,
  fetcher: typeof fetch,
): Promise<unknown> {
  const response = await fetcher(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if ([400, 401, 403, 409, 413, 422].includes(response.status)) {
    throw new InputError(
      "The planner could not accept this request. Check your message and schedule, then try again.",
    );
  }
  if (!response.ok) throw new Error("Planner service unavailable");
  return response.json();
}

export async function requestPlan(
  message: string,
  previous: Constraints,
  state: DemoState,
  fetcher = globalThis.fetch,
  /** When true, unrecognised messages are forwarded to the server for watsonx interpretation. */
  watsonxMode = false,
) {
  const interpreted = interpretRequest(message, previous);
  if (interpreted.clarification)
    throw new PlanningClarification(
      interpreted.clarification,
      interpreted.constraints,
      interpreted.clocks || [],
      interpreted.restatement,
    );
  // In simulated mode, unrecognised messages don't reach the server — the browser shows
  // the limited-demo hint immediately. In watsonx mode, all messages are forwarded so the
  // model can interpret them; the server's response determines understood/clarification.
  const locallyUnderstood = interpreted.understood;
  if (!locallyUnderstood && !watsonxMode) {
    throw new InputError(
      "I\u2019m a limited demo planner. Try interests like AI, career, internship, social, arts, or wellbeing, plus a day or time. For example: \u201CCareer events on Wednesday\u201D or \u201CSomething to help me find an internship.\u201D",
    );
  }
  try {
    const result = (await post(
      "/api/plan",
      {
        message,
        previous,
        state: schedulePayload(state),
        profile: profilePayload(state),
      },
      fetcher,
    )) as PlanResponse;
    if (
      (result.mode !== "simulated" && result.mode !== "watsonx") ||
      (result.notice !== undefined && typeof result.notice !== "string") ||
      typeof result.understood !== "boolean" ||
      !Array.isArray(result.event_ids) ||
      !result.constraints ||
      typeof result.constraints !== "object" ||
      result.event_ids.some((id) => !EVENTS.some((e) => e.id === id))
    ) {
      throw new Error("Invalid planner response");
    }
    validateConstraints(result.constraints);
    if (result.clarification)
      throw new PlanningClarification(result.clarification, result.constraints, []);
    if (!result.understood) {
      // Simulated mode: show the limited-demo hint.
      // Watsonx mode always sets understood:true, so this only fires for simulated.
      throw new InputError(
        locallyUnderstood
          ? "The simulated planner did not understand this request. Try an interest, day or time."
          : "I\u2019m a limited demo planner. Try interests like AI, career, internship, social, arts, or wellbeing, plus a day or time. For example: \u201CCareer events on Wednesday\u201D or \u201CSomething to help me find an internship.\u201D",
      );
    }
    return {
      constraints: result.constraints,
      ids: result.event_ids,
      evidence: (result.recommendations || []).filter(
        (e) =>
          result.event_ids.includes(e.event_id) &&
          [e.interest_match, e.schedule_fit, e.practical, e.trade_offs].every(
            (v) => typeof v === "string",
          ),
      ),
      source: "rust",
      // Which interpreter actually answered; a failed watsonx call is reported as simulated.
      mode: result.mode,
      explanations: result.explanations,
      // A watsonx fallback notice comes first, then any explanation of why nothing matched.
      notice: [
        result.notice ?? "",
        !result.event_ids.length && typeof result.diagnostic === "string"
          ? result.diagnostic
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  } catch (error) {
    if (error instanceof InputError) throw error;
    const { constraints } = interpreted;
    const demoState = state as DemoState;
    const appliedIds = demoState.appliedUpdateIds ?? [];
    // Browser fallback: build an effective state that respects update-cancelled/full events,
    // and uses time-moved effective event times for conflict checks.
    const effEvts = effectiveEvents(appliedIds);
    const effectiveCancelled = [
      ...state.cancelled,
      ...EVENTS.filter((e) => isUnavailableByUpdate(e.id, appliedIds))
        .map((e) => e.id)
        .filter((id) => !state.cancelled.includes(id)),
    ];
    const effectiveState: Schedule = { ...state, cancelled: effectiveCancelled };
    return {
      constraints,
      ids: recommend(effectiveState, constraints, 3, true, effEvts).map((e) => e.id),
      evidence: [],
      source: "browser-fallback",
      mode: "simulated" as const,
      explanations: "template" as const,
      notice:
        "The Rust planner is unavailable. These suggestions use the browser's simulated demo planner.",
    };
  }
}

export async function validateEvent(
  id: string,
  state: Schedule,
  fetcher = globalThis.fetch,
) {
  try {
    const result = (await post(
      "/api/validate",
      { event_id: id, state: schedulePayload(state) },
      fetcher,
    )) as { allowed: boolean; issue: string | null };
    if (
      typeof result.allowed !== "boolean" ||
      !(result.issue === null || typeof result.issue === "string")
    ) {
      throw new Error("Invalid validation response");
    }
    return {
      issue: result.allowed ? null : result.issue || "Event unavailable",
      notice: "",
    };
  } catch (error) {
    if (error instanceof InputError) throw error;
    const event = EVENTS.find((e) => e.id === id);
    return {
      issue: event ? issue(event, state) : "Unknown event",
      notice: "Checked locally; the Rust planner is unavailable.",
    };
  }
}

export async function enrollEvent(
  id: string,
  state: Schedule,
  rsvp?: Rsvp,
  fetcher = globalThis.fetch,
) {
  const event = EVENTS.find((e) => e.id === id);
  if (!event) throw new InputError("Unknown event.");
  const problem = issue(event, state);
  if (problem) throw new InputError(problem);
  const required = event.rsvp === "RSVP required";
  if (
    required &&
    (!rsvp?.attending ||
      !rsvp.display_name.trim() ||
      new TextEncoder().encode(rsvp.display_name).length > 120)
  ) {
    throw new InputError(
      "Complete the required RSVP before adding this event.",
    );
  }
  try {
    const result = (await post(
      "/api/enroll",
      { event_id: id, state: schedulePayload(state), rsvp },
      fetcher,
    )) as {
      event_id: string;
      demo: boolean;
      status: string;
      rsvp_confirmed: boolean;
    };
    if (
      result.event_id !== id ||
      result.demo !== true ||
      result.status !== "enrolled" ||
      result.rsvp_confirmed !== required
    )
      throw new Error("Invalid enrollment response");
    return { notice: "", rsvpConfirmed: required };
  } catch (error) {
    if (error instanceof InputError) throw error;
    return {
      notice: "Saved locally in demo mode; the Rust service is unavailable.",
      rsvpConfirmed: required,
    };
  }
}

/** Honest label for the interpreter that produced a planning result. */
export const planModeLabel = (result: {
  source: string;
  mode: "simulated" | "watsonx";
  explanations?: "watsonx" | "template";
}) => {
  if (result.source !== "rust") return "Browser fallback · Simulated";
  if (result.mode === "watsonx") {
    const suffix =
      result.explanations === "watsonx"
        ? " · AI explanations"
        : result.explanations === "template"
          ? " · Template evidence"
          : "";
    return `Rust planner · IBM watsonx${suffix}`;
  }
  return "Rust planner · Simulated";
};
