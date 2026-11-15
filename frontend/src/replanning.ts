import type { CampusEvent, Constraints, RecommendationEvidence } from "./types.ts";
import { time as formatTime } from "./data.ts";

export function replacementConstraints(
  previous: Constraints,
  cancelled: CampusEvent,
): Constraints {
  return {
    ...previous,
    topics: previous.topics?.length ? previous.topics : [cancelled.topic],
    limit: 1,
  };
}
export function constraintSummary(c: Constraints): string {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return [
    c.topics?.join(" / "),
    c.days && `days: ${c.days.map((d) => days[d]).join(", ")}`,
    c.after != null && `start after ${formatTime(c.after)}`,
    c.before != null && `finish before ${formatTime(c.before)}`,
    c.food && `food: ${c.food}`,
    c.free && "free admission",
    c.excluded?.length && `excluding ${c.excluded.join(", ")}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Build a template trade-off description comparing the alternative event against the lost event.
 * Covers goal type, food, time, host school, and access conditions.
 */
export function templateTradeOff(
  alternative: CampusEvent,
  lost: CampusEvent,
): string {
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const goalMatch =
    lost.goal_type?.length && alternative.goal_type?.length
      ? alternative.goal_type.some((g) => lost.goal_type?.includes(g))
        ? `same goal type (${alternative.goal_type.filter((g) => lost.goal_type?.includes(g)).join(", ")})`
        : `different goal type — ${alternative.goal_type.join(", ")} vs ${lost.goal_type.join(", ")}`
      : alternative.goal_type?.length
        ? `goal: ${alternative.goal_type.join(", ")}`
        : "goal type not confirmed";
  const foodLine =
    alternative.food === lost.food
      ? `same food (${alternative.food})`
      : `food: ${alternative.food} vs ${lost.food}`;
  const timeLine = `${DAYS[alternative.day] ?? "Unknown"} ${formatTime(alternative.start)}–${formatTime(alternative.end)} vs ${DAYS[lost.day] ?? "Unknown"} ${formatTime(lost.start)}–${formatTime(lost.end)}`;
  const hostLine =
    alternative.host_school && lost.host_school
      ? alternative.host_school === lost.host_school
        ? `same host (${alternative.host_school})`
        : `hosted by ${alternative.host_school} vs ${lost.host_school}`
      : alternative.host_school
        ? `hosted by ${alternative.host_school}`
        : "host not confirmed";
  const accessLine =
    alternative.access === "open"
      ? "open access"
      : alternative.access === "members"
        ? "members only"
        : alternative.access === "full"
          ? "at capacity"
          : "access not confirmed";
  return `Trade-off vs "${lost.title}": ${goalMatch}. ${foodLine}. ${timeLine}. ${hostLine}. ${accessLine}. Template evidence.`;
}

/**
 * Build a trade-off description from watsonx recommendation evidence.
 * Uses only cited record fields; never claims confirmed access for unknown conditions.
 */
export function watsonxTradeOff(
  alternative: CampusEvent,
  lost: CampusEvent,
  evidence: RecommendationEvidence,
): string {
  // Use the AI reason if present and cited fields are valid (not claiming "confirmed access" for unknowns).
  const aiReason = evidence.ai_reason ?? "";
  const hasUnknownAccess =
    alternative.access_conditions &&
    Object.values(alternative.access_conditions).some((v) => v === "unknown");
  const safeReason =
    hasUnknownAccess && aiReason.toLowerCase().includes("confirmed access")
      ? `${aiReason} (Note: access conditions for this event are not fully confirmed.)`
      : aiReason;
  const tradeOff = evidence.trade_offs
    ? `${evidence.trade_offs}\n\nVs "${lost.title}": ${templateTradeOff(alternative, lost)}`
    : templateTradeOff(alternative, lost);
  return safeReason
    ? `${safeReason}\n\n${tradeOff}\n\nWritten by IBM watsonx (Granite).`
    : `${tradeOff}\n\nWritten by IBM watsonx (Granite).`;
}

/**
 * Detect an availability-change request: "I'm busy Thursday", "I can't do Tuesday afternoon", etc.
 * Returns the day indices mentioned as unavailable, or null if this is not an availability-change request.
 */
export function detectAvailabilityChange(text: string): {
  busyDays: number[];
  summary: string;
} | null {
  const q = text.toLowerCase();
  const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const DAY_ABBR = ["mon", "tue", "wed", "thu", "fri"];

  // Must match a "busy/unavailable on [day]" pattern.
  const busyPattern =
    /\b(?:busy|not\s+(?:free|available)|can(?:not|'t)\s+(?:do|make|attend)|unavailable|have\s+(?:class|a\s+(?:class|meeting|seminar|lecture|commitment|conflict))|tied\s+up)\b/.test(q);
  if (!busyPattern) return null;

  const busyDays: number[] = [];
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (
      new RegExp(`\\b${DAY_NAMES[i]}\\b`).test(q) ||
      new RegExp(`\\b${DAY_ABBR[i]}\\b`).test(q)
    ) {
      busyDays.push(i);
    }
  }
  if (!busyDays.length) return null;

  const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const summary = `Removed ${busyDays.map((d) => DAY_LABELS[d]).join(", ")} from your available days.`;
  return { busyDays, summary };
}
