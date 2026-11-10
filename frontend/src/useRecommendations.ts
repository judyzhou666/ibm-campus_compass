import { useEffect, useState } from "react";
import { requestPlan, recommendationSettingsKey } from "./api.ts";
import type {
  DemoState,
  Constraints,
  RecommendationMatchResult,
} from "./types.ts";
export function useRecommendations(
  state: DemoState,
  constraints: Constraints = {},
  enabled = true,
) {
  const [attempt, setAttempt] = useState(0);
  const requestConstraints: Constraints = {
    ...constraints,
    mode: constraints.mode ?? "plan-building",
  };
  const key =
    recommendationSettingsKey(state) +
    JSON.stringify(requestConstraints) +
    `:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    ids: string[];
    notice: string;
    source: string;
    matchReasons: RecommendationMatchResult[];
  } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void requestPlan(
      "Find events",
      requestConstraints,
      state,
      undefined,
      undefined,
      true,
    )
      .then((r) => {
        if (active)
          setResult({
            key,
            ids: r.ids,
            notice: r.notice,
            source: r.source,
            matchReasons: r.matchReasons,
          });
      })
      .catch(() => {
        if (active)
          setResult({
            key,
            ids: [],
            matchReasons: [],
            notice:
              "Recommendations unavailable. Review your preferences or try again.",
            source: "error",
          });
      });
    return () => {
      active = false;
    };
  }, [key, enabled]);
  const current = !enabled
    ? { ids: [], matchReasons: [], notice: "", source: "idle", loading: false }
    : result?.key === key
      ? { ...result, loading: false }
      : {
          ids: [],
          matchReasons: [],
          notice: "Checking your saved preferences…",
          source: "loading",
          loading: true,
        };
  return { ...current, retry: () => setAttempt((value) => value + 1) };
}
