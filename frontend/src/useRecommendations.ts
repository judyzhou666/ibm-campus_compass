import { useEffect, useState } from "react";
import { requestPlan, planningKey } from "./api.ts";
import type { DemoState, Constraints } from "./types.ts";
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
  } | null>(null);
  useEffect(() => {
    let active = true;
    void requestPlan("Find events", constraints, state)
      .then((r) => {
        if (active)
          setResult({ key, ids: r.ids, notice: r.notice, source: r.source });
      })
      .catch(() => {
        if (active)
          setResult({
            key,
            ids: [],
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
        notice: "Checking your saved preferences…",
        source: "loading",
        loading: true,
      };
}
