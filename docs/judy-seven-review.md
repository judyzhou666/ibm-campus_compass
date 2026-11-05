# Judy's seven review findings

Work is local to Doris. Each section records checks run for that issue; final checks are recorded separately. No live IBM account verification is implied by local mock or simulated tests.

## 1. Temporary exploration lifecycle

Changed App's exploration action, both interpreters, internal request continuations and recommendation hooks. An ordinary next message clears a previous `explore:true` and its temporary discovery mode. Reset clears mode and exploration. Explicit beyond-interest requests set them again; refresh/Show another and the exploration briefing deliberately reapply their selected context. Explicit caller constraints remain supported. The old API fixture's beyond-interest case now uses explicit plan-building wording with the same results; only mode metadata was updated.

Checks: 12 focused TypeScript lifecycle/mode/refresh tests; Rust exploration lifecycle test; frontend typecheck; API integration; 28 exact shared comparisons passed. Updated integration callers to distinguish intentional exploration from ordinary follow-ups.

## 2. Complete no-match explanations

Changed Rust planner selection and diagnostics to share exploration/dismissal exclusions. Diagnostics distinguish hidden events and beyond-interest exclusions after genuine eligibility checks, and suggest restoring hidden events, a new search or start over without automatically relaxing anything.

Checks: 2 focused Rust exclusion tests and 3 original ranking/evidence regression tests passed. Existing selection and explanation baselines remain intact for unaffected requests.

## 3. Filtered comparison alternatives

Rust comparison candidates now use the same exploration/dismissal exclusion helper as recommendation selection, alongside existing access, preference, constraint and planned-event checks. Evidence reuses the operation's active-topic snapshot.

Checks: 3 focused Rust filtering/diagnostic tests and 3 original ranking/evidence tests passed. Added assertions for hidden comparisons, eligible restored comparisons and enabled learning topics excluded during exploration. No captured response baseline changes were necessary.

## 4. Recommendation request identity

`planningKey` now uses only the transmitted recommendation schedule and current search constraints. Text, profile fields and guidance are excluded. Presentation/history identity remains separate. App invalidation uses recommendation settings rather than raw proposal revisions, while note/guidance-only preference saves preserve current search and draft suggestions. Actual ranking/schedule changes still reset obsolete requests.

Checks: frontend typecheck and 13 focused key/history/refresh tests passed, including stable keys for notes/guidance/disabled goals, different keys for real constraints, and delayed-response acceptance versus rejection. Final browser checks cover effect-level deduplication and save behavior.
