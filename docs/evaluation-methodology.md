# Evaluation methodology

## Reproduce

From the repository root with Node 22.12+ and stable Rust:

```sh
npm ci
npm run build
cargo build --locked
npm run evaluate
```

The runner starts its own loopback Rust server on an ephemeral port and terminates it on completion/failure. It makes no external model requests and never changes student storage. It writes `evaluation/results.json` (all 60 adapter/case observations with raw IDs, evidence and metric counts) and `docs/evaluation-report.md`. Scenario bytes are checksum-locked by `evaluation/scenarios.sha256`; deliberate expectation revisions require review and a new version. The first measurement exposed a five-result recall denominator error; a metric regression test now covers that denominator. Ranking/expectations were not changed to hide that error.

## Independent expectations and splits

`evaluation/scenarios.json` was written before ranking changes: 12 development and 8 held-out cases. Expected relevant IDs, topics and explicit constraints are manually specified from synthetic records, not obtained from the tested ranking. Relevance uses those expectations intersected with per-event eligibility, existing plan, cancellation and availability. Some relevant *records* intentionally cannot be recommended (e.g. unknown eligibility), giving zero feasible relevant items and N/A recall rather than rewarding unsafe output. Constraints use event end times as well as start times.

Held-out cases were fixed before tuning; developers can read them, so they are not blinded. This small visible suite cannot establish generalization. No real-world dataset, user assessment or time savings have been measured. Changes to metrics require checking raw outputs and denominator tests, not changing expected results to match implementation.

## Baselines

- **A Keyword/category:** searches title/description/topic/category for non-stopword query terms, ranks by token hits, and returns up to 3 (or requested 1–5) results. It has no schedule, eligibility, cancellation, prior-filter interpretation or explanatory capability. Category words participate in the same text index. This is one deliberately simple search baseline, not every university search system.
- **B Rules:** the same deterministic interpretation and hard-filter/access/conflict checks, then free-admission-first chronological selection with pairwise buffer checks. No preference bonus, topic-diversity bonus or explanations. The TypeScript implementation is the tested reference shared with offline fallback. It benefits from the current clarification handling, making it a stronger comparison than raw search.
- **C Context/Rust:** actual Rust `/api/plan` outputs, using topic/availability/preferred-time context, diversity-aware greedy selection and catalog-derived evidence. It is entirely deterministic; it is **not a live LLM or autonomous AI agent**.

A and B expose food labels directly from the catalog; they do not manufacture explanations. C’s food labels in this evaluation also come from returned trusted IDs; its separate source-faithfulness check tests food claims in actual Rust practical evidence. That label-copy metric is intentionally easy and should not be presented as AI understanding.

## Metrics and denominators

Every report cell includes integer numerator/denominator, aggregated separately for development and held-out cases. Zero denominator means N/A, never automatic success.

| Metric | Numerator / denominator |
|---|---|
| Relevant retrieval precision | Eligible relevant selected records / selected records, excluding clarification/unsupported cases |
| Capped retrieval recall | Eligible relevant selected records / min(requested slots, number of independently eligible relevant records), excluding clarification/unsupported cases |
| Schedule conflict violations (lower better) | Selected records conflicting with a busy commitment, retained plan, or an earlier selected record (including travel buffer) / selected records |
| Eligibility violations (lower better) | Selected restricted, unknown-access, full or cancelled records / selected records |
| Constraint satisfaction | Selections meeting manually specified topic/day/start/end/cost/food/exclusion constraints / selections |
| Source faithfulness | Returned evidence items whose description, location, RSVP, food, source and unverified label match their synthetic record / returned evidence items; no evidence = N/A |
| Food-label accuracy | Selections displaying the exact trusted food label / selections |
| Diversity | Distinct eligible relevant topics covered / min(requested slots, eligible relevant topics available) |
| Replanning validity | Replacement cases retaining strict constraints, avoiding retained-plan/conflict/restricted/cancelled events, and returning an alternative if one is eligible / replacement cases |
| Explanation quality checklist | Present factual interest-description, buffer, RSVP, source/trade-off and comparison-with-uninterpreted-goals disclosure items / 5 × selected records |
| Request handling | Correct empty-output unsupported or clarification status / designated unsupported/ambiguous cases |

Recall is slot-capped and per-event eligible; it is not full-catalog recall and does not solve the maximum compatible subset problem. Pairwise violations are scored separately. Diversity similarly measures topic coverage, not novelty to a real person. Replanning metrics score suggestion validity; separate workflow/browser tests verify that calendar/RSVP state is unchanged until approval.

The explanation checklist is a programmatic structural/factual check, **not a human rating** of persuasiveness or usefulness. Baselines without explanations get zero checklist items rather than invented explanation text. Template faithfulness is expected to be high on embedded records and does not establish external truth or LLM grounding. Selection may have trade-offs even when all checks pass.

## Actual findings and future live-AI comparison

Use the generated report for current numbers and case-level failures. The measured context planner improves safe discovery over this keyword baseline and development-set topic coverage over the chronological rule baseline. Held-out rules and context selection have equal measured retrieval/coverage on this small suite; the evidence does not support claiming superior held-out retrieval or LLM value.

Live IBM watsonx: **Not yet evaluated.** After authorized credentials/model access, freeze additional unseen real-language paraphrases and challenging intent cases; compare both intent extraction and downstream validated plans to A/B/C on the same catalog. Collect blinded human explanation usefulness, clarification success, latency, cost and repeat-run variance, plus malformed-output/timeouts. Keep deterministic safety checks and report abstentions, unsupported intents and constraint failures separately. Do not claim interviews, organizer trust, retention, attendance or business outcomes without collecting those observations.
