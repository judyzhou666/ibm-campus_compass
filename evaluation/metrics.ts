import type {
  CampusEvent,
  Constraints,
  DemoState,
  RecommendationEvidence,
} from "../frontend/src/types.ts";
import { EVENTS } from "../frontend/src/data.ts";
import { issue, overlap } from "../frontend/src/planner.ts";
export interface Scenario {
  id: string;
  split: string;
  description: string;
  message: string;
  state?: Partial<DemoState>;
  previous?: Constraints;
  constraints?: Constraints;
  relevant_ids?: string[];
  expected_topics?: string[];
  expect_status?: string;
  replan?: boolean;
}
export interface Output {
  ids: string[];
  status: string;
  evidence: RecommendationEvidence[];
  food: Record<string, string>;
}
export interface Ratio {
  numerator: number;
  denominator: number;
}
export const ratio = (numerator: number, denominator: number): Ratio => ({
  numerator,
  denominator,
});
export function satisfies(e: CampusEvent, c: Constraints = {}) {
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
export function measure(
  s: Scenario,
  state: DemoState,
  out: Output,
): Record<string, Ratio> {
  const selected = out.ids
    .map((id) => EVENTS.find((e) => e.id === id))
    .filter((e): e is CampusEvent => !!e);
  const relevant = EVENTS.filter(
    (e) =>
      !state.plan.includes(e.id) &&
      !issue(e, state) &&
      satisfies(e, s.constraints) &&
      (!s.relevant_ids || s.relevant_ids.includes(e.id)) &&
      (!s.expected_topics || s.expected_topics.includes(e.topic)),
  );
  const eligibleRelevant = new Set(relevant.map((e) => e.id));
  const correct = selected.filter((e) => eligibleRelevant.has(e.id)).length;
  const conflicts = selected.filter((e, i) =>
    [
      ...state.blocks,
      ...EVENTS.filter(
        (x) =>
          state.plan.includes(x.id) &&
          !state.cancelled.includes(x.id) &&
          x.id !== e.id,
      ),
      ...selected.slice(0, i),
    ].some((x) => overlap(e, x, state.buffer)),
  ).length;
  const desired = new Set(relevant.map((e) => e.topic));
  const covered = new Set(
    selected.filter((e) => eligibleRelevant.has(e.id)).map((e) => e.topic),
  );
  const planning = !s.expect_status;
  const limit =
    s.previous?.limit ||
    Number(s.message.match(/\b([1-5])\s+events/)?.[1]) ||
    3;
  const proof = out.evidence.filter((p) => out.ids.includes(p.event_id));
  const faithful = proof.filter((p) => {
    const e = EVENTS.find((e) => e.id === p.event_id);
    return (
      e &&
      p.interest_match.includes(e.description) &&
      p.practical.includes(e.location) &&
      p.practical.includes(e.rsvp) &&
      p.practical.includes(e.food) &&
      p.trade_offs.includes(e.source) &&
      p.trade_offs.includes("not externally verified")
    );
  }).length;
  let quality = 0;
  for (const e of selected) {
    const p = proof.find((p) => p.event_id === e.id);
    if (p) {
      quality +=
        Number(p.interest_match.includes(e.description)) +
        Number(p.schedule_fit.includes(String(state.buffer))) +
        Number(p.practical.includes(e.rsvp)) +
        Number(p.trade_offs.includes(e.source)) +
        Number(
          !!p.comparison &&
            p.comparison.includes(
              "Major and free-text goals are not interpreted",
            ),
        );
    }
  }
  return {
    precision: ratio(planning ? correct : 0, planning ? out.ids.length : 0),
    recall: ratio(
      planning ? correct : 0,
      planning ? Math.min(limit, relevant.length) : 0,
    ),
    conflict_violations: ratio(conflicts, out.ids.length),
    eligibility_violations: ratio(
      selected.filter(
        (e) => e.access !== "open" || state.cancelled.includes(e.id),
      ).length,
      out.ids.length,
    ),
    constraint_satisfaction: ratio(
      selected.filter((e) => satisfies(e, s.constraints)).length,
      out.ids.length,
    ),
    source_faithfulness: ratio(faithful, proof.length),
    food_accuracy: ratio(
      selected.filter((e) => out.food[e.id] === e.food).length,
      out.ids.length,
    ),
    diversity: ratio(
      planning ? covered.size : 0,
      planning ? Math.min(limit, desired.size) : 0,
    ),
    replanning_validity: ratio(
      s.replan &&
        (relevant.length === 0 || selected.length > 0) &&
        selected.every(
          (e) =>
            !issue(e, state) &&
            satisfies(e, s.constraints) &&
            !state.plan.includes(e.id),
        ) &&
        conflicts === 0
        ? 1
        : 0,
      s.replan ? 1 : 0,
    ),
    explanation_quality: ratio(quality, selected.length * 5),
    request_handling: ratio(
      s.expect_status
        ? Number(out.status === s.expect_status && out.ids.length === 0)
        : 0,
      s.expect_status ? 1 : 0,
    ),
  };
}
