import {
  readMatchReasons,
  readCatalogEvidence,
} from "./recommendationReasons.ts";
import { wirePreferences } from "./preferences.ts";
import type {
  Schedule,
  RecommendationSchedule,
  Constraints,
  DemoState,
  PlanResponse,
  Rsvp,
} from "./types.ts";
import { EVENTS } from "./data.ts";
import { recommendWithReasons, issue } from "./planner.ts";
import {
  PlanningClarification,
  interpretRequest,
  validateConstraints,
} from "./interpretation.ts";

// Guidance only changes browser presentation; it is not needed by the server.
function requestPreferences(state: Schedule) {
  const { guidance: _guidance, ...preferences } = wirePreferences(state);
  return preferences;
}

export const schedulePayload = (state: Schedule): RecommendationSchedule => ({
  plan: [...state.plan],
  cancelled: [...state.cancelled],
  interests: [...state.interests],
  buffer: state.buffer,
  preferred_time: state.preferred_time || "any",
  preferences: state.preferences ? requestPreferences(state) : undefined,
  blocks: state.blocks.map(({ day, start, end }) => ({
    day,
    start,
    end,
  })),
});

export const planningKey = (state: DemoState) =>
  JSON.stringify([
    schedulePayload(state),
    state.constraints,
    state.preferences,
  ]);

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
  state: Schedule,
  fetcher = globalThis.fetch,
  exactTopics?: readonly string[],
) {
  const interpreted = interpretRequest(message, previous);
  // Proposal topics are already reviewed mappings. Parse all safeguards first,
  // then keep those exact topics instead of reinterpreting intent-prefix words.
  if (exactTopics) {
    interpreted.constraints = {
      ...interpreted.constraints,
      topics: [...exactTopics],
    };
    validateConstraints(interpreted.constraints);
  }
  if (interpreted.clarification)
    throw new PlanningClarification(
      interpreted.clarification,
      interpreted.constraints,
      interpreted.clocks || [],
      interpreted.restatement,
    );
  if (!interpreted.understood)
    throw new InputError(
      "I’m a limited demo planner. Try an interest such as AI, career, social, arts, or wellbeing, plus a day or time. For example: “AI events on Tuesday after 1 PM.”",
    );
  try {
    const result = (await post(
      "/api/plan",
      {
        message: exactTopics ? "Find events" : message,
        previous: exactTopics ? interpreted.constraints : previous,
        state: schedulePayload(state),
      },
      fetcher,
    )) as PlanResponse;
    if (
      result.mode !== "simulated" ||
      typeof result.understood !== "boolean" ||
      !Array.isArray(result.event_ids) ||
      !result.constraints ||
      typeof result.constraints !== "object" ||
      result.event_ids.some((id) => !EVENTS.some((e) => e.id === id))
    ) {
      throw new Error("Invalid planner response");
    }
    validateConstraints(result.constraints);
    const matchReasons = readMatchReasons(
      result.matchReasons,
      result.event_ids,
    );
    if (!matchReasons) throw new Error("Invalid structured match reasons");
    if (result.clarification) throw new InputError(result.clarification);
    if (!result.understood)
      throw new InputError(
        "The simulated planner did not understand this request. Try an interest, day or time.",
      );
    return {
      constraints: result.constraints,
      ids: result.event_ids,
      matchReasons,
      evidence: readCatalogEvidence(result.recommendations, result.event_ids),
      source: "rust",
      notice:
        !result.event_ids.length && typeof result.diagnostic === "string"
          ? result.diagnostic
          : "",
    };
  } catch (error) {
    if (error instanceof InputError) throw error;
    const { constraints } = interpreted;
    const selected = recommendWithReasons(state, constraints);
    return {
      constraints,
      ids: selected.map(({ event }) => event.id),
      matchReasons: selected.map(({ event, score, matches }) => ({
        event_id: event.id,
        score,
        matches,
      })),
      evidence: [],
      source: "browser-fallback",
      notice:
        "The Rust planner is unavailable. These suggestions use the browser’s simulated demo planner.",
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
