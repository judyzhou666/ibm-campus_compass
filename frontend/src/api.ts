import type {
  Schedule,
  Constraints,
  DemoState,
  PlanResponse,
} from "./types.ts";
import { EVENTS } from "./data.ts";
import { parseRequest, recommend, issue } from "./planner.ts";

export const schedulePayload = (state: Schedule) => ({
  plan: [...state.plan],
  cancelled: [...state.cancelled],
  interests: [...state.interests],
  buffer: state.buffer,
  blocks: state.blocks.map(({ title, day, start, end }) => ({
    title,
    day,
    start,
    end,
  })),
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
  if ([400, 413, 422].includes(response.status)) {
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
) {
  try {
    const result = (await post(
      "/api/plan",
      { message, previous, state: schedulePayload(state) },
      fetcher,
    )) as PlanResponse;
    if (
      result.mode !== "simulated" ||
      !Array.isArray(result.event_ids) ||
      !result.constraints ||
      typeof result.constraints !== "object" ||
      result.event_ids.some((id) => !EVENTS.some((e) => e.id === id))
    ) {
      throw new Error("Invalid planner response");
    }
    return {
      constraints: result.constraints,
      ids: result.event_ids,
      source: "rust",
      notice: "",
    };
  } catch (error) {
    if (error instanceof InputError) throw error;
    const constraints = parseRequest(message, previous);
    return {
      constraints,
      ids: recommend(state, constraints).map((e) => e.id),
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
