import { validateConstraints } from "./interpretation.ts";
import { RANKING_WEIGHTS } from "./planner.ts";
import type { RecommendationMatchResult } from "./types.ts";
/** Validate both server results and persisted local snapshots; never reconstruct old reasons. */
export function readMatchReasons(
  value: unknown,
  ids: readonly string[],
): RecommendationMatchResult[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > ids.length) return null;
  const input = value as RecommendationMatchResult[];
  if (
    new Set(input.map((r) => r?.event_id)).size !== input.length ||
    input.some(
      (r) =>
        !r ||
        !ids.includes(r.event_id) ||
        !Number.isInteger(r.score) ||
        !Array.isArray(r.matches) ||
        r.matches.length > 8 ||
        new Set(r.matches.map((m) => m?.kind)).size !== r.matches.length ||
        r.matches.some(
          (m) =>
            !m ||
            !Object.hasOwn(RANKING_WEIGHTS, m.kind) ||
            m.points !== RANKING_WEIGHTS[m.kind] ||
            typeof m.explanation !== "string" ||
            m.explanation.length > 500,
        ) ||
        r.score !== r.matches.reduce((sum, m) => sum + m.points, 0),
    )
  )
    return null;
  return input.map(({ event_id, score, matches }) => ({
    event_id,
    score,
    matches: matches.map(({ kind, points, explanation }) => ({
      kind,
      points,
      explanation,
    })),
  }));
}

/** Keep bounded, allowlisted catalog evidence when restoring a historical message. */
export function readCatalogEvidence(
  value: unknown,
  ids: readonly string[],
): import("./types.ts").RecommendationEvidence[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, ids.length).flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      !ids.includes(item.event_id) ||
      seen.has(item.event_id)
    )
      return [];
    const required = [
      "interest_match",
      "schedule_fit",
      "practical",
      "trade_offs",
    ] as const;
    if (
      required.some(
        (key) => typeof item[key] !== "string" || item[key].length > 5000,
      )
    )
      return [];
    const clean: import("./types.ts").RecommendationEvidence = {
      event_id: item.event_id,
      interest_match: item.interest_match,
      schedule_fit: item.schedule_fit,
      practical: item.practical,
      trade_offs: item.trade_offs,
    };
    for (const key of [
      "comparison",
      "discovery_context",
      "learning_connection",
      "participation_fit",
    ] as const)
      if (typeof item[key] === "string" && item[key].length <= 5000)
        clean[key] = item[key];
    if (item.constraints_satisfied !== undefined) {
      try {
        validateConstraints(item.constraints_satisfied);
        clean.constraints_satisfied = structuredClone(
          item.constraints_satisfied,
        );
      } catch {
        /* Invalid optional snapshot constraints are not displayed or reused. */
      }
    }
    seen.add(item.event_id);
    return [clean];
  });
}
