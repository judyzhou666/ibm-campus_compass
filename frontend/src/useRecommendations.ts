import { useEffect, useState } from "react";
import { requestPlan, planningKey } from "./api.ts";
import type {
  DemoState,
  Constraints,
  RecommendationMatchResult,
} from "./types.ts";
export function useRecommendations(
  state: DemoState,
  constraints: Constraints = {},
) {
  const key = planningKey(state) + JSON.stringify(constraints);
  const [result, setResult] = useState<{
    key: string;
    ids: string[];
    notice: string;
    source: string;
    matchReasons: RecommendationMatchResult[];
  } | null>(null);
  useEffect(() => {
    let active = true;
    void requestPlan("Find events", constraints, state)
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
  }, [key]);
  return result?.key === key
    ? { ...result, loading: false }
    : {
        ids: [],
        matchReasons: [],
        notice: "Checking your saved preferences…",
        source: "loading",
        loading: true,
      };
}
