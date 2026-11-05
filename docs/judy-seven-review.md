# Judy's seven review findings

Work is local to Doris. Each section records checks run for that issue; final checks are recorded separately. No live IBM account verification is implied by local mock or simulated tests.

## 1. Temporary exploration lifecycle

Commit: `36de68f`. Files: `backend/src/interpreter.rs`, `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/src/conversation.ts`, `frontend/src/interpretation.ts`, `frontend/src/useRecommendations.ts`, `tests/backend-integration.ts`, `tests/exploration-lifecycle.test.ts`, `tests/fixtures/rust-ranking-before-optimization.json`, `tests/preference-parity.ts`, `tests/recommendation-modes.test.ts`.

Changed App's exploration action, both interpreters, internal request continuations and recommendation hooks. An ordinary next message clears a previous `explore:true` and its temporary discovery mode. Reset clears mode and exploration. Explicit beyond-interest requests set them again; refresh/Show another and the exploration briefing deliberately reapply their selected context. Explicit caller constraints remain supported. The old API fixture's beyond-interest case now uses explicit plan-building wording with the same results; only mode metadata was updated.

Checks: 12 focused TypeScript lifecycle/mode/refresh tests; Rust exploration lifecycle test; frontend typecheck; API integration; 28 exact shared comparisons passed. Updated integration callers to distinguish intentional exploration from ordinary follow-ups.

## 2. Complete no-match explanations

Commit: `0864b09`. Files: `backend/src/planner.rs`.

Changed Rust planner selection and diagnostics to share exploration/dismissal exclusions. Diagnostics distinguish hidden events and beyond-interest exclusions after genuine eligibility checks, and suggest restoring hidden events, a new search or start over without automatically relaxing anything.

Checks: 2 focused Rust exclusion tests and 3 original ranking/evidence regression tests passed. Existing selection and explanation baselines remain intact for unaffected requests.

## 3. Filtered comparison alternatives

Commit: `1234ed7`. Files: `backend/src/planner.rs`.

Rust comparison candidates now use the same exploration/dismissal exclusion helper as recommendation selection, alongside existing access, preference, constraint and planned-event checks. Evidence reuses the operation's active-topic snapshot.

Checks: 3 focused Rust filtering/diagnostic tests and 3 original ranking/evidence tests passed. Added assertions for hidden comparisons, eligible restored comparisons and enabled learning topics excluded during exploration. No captured response baseline changes were necessary.

## 4. Recommendation request identity

Commit: `a09def5`. Files: `frontend/src/App.tsx`, `frontend/src/MyPreferences.tsx`, `frontend/src/api.ts`, `tests/planning-key.test.ts`.

`planningKey` now uses only the transmitted recommendation schedule and current search constraints. Text, profile fields and guidance are excluded. Presentation/history identity remains separate. App invalidation uses recommendation settings rather than raw proposal revisions, while note/guidance-only preference saves preserve current search and draft suggestions. Actual ranking/schedule changes still reset obsolete requests.

Checks: frontend typecheck and 13 focused key/history/refresh tests passed, including stable keys for notes/guidance/disabled goals, different keys for real constraints, and delayed-response acceptance versus rejection. Final browser checks cover effect-level deduplication and save behavior.

## 5. Explicit discovery intent

Commit: `9d322f0`. Files: `backend/src/interpreter.rs`, `frontend/src/interpretation.ts`, `tests/preference-parity.ts`, `tests/recommendation-modes.test.ts`.

Both interpreters now prioritize explicit discover/browse/explore wording. Plan construction requires a bounded phrase such as “build my weekly schedule,” not a broad match between “make” and “week.” “Explore social events to make friends this week” therefore selects discovery.

Checks: 9 focused TypeScript mode/lifecycle tests, 2 Rust lifecycle/intent tests and 31 exact shared comparisons passed. Added matching TS/Rust cases for discovery, intentional schedule construction and incidental social wording.

## 6. Dashboard-only recommendation requests

Commit: `bcb866e`. Files: `frontend/src/App.tsx`, `frontend/src/useRecommendations.ts`, `scripts/browser-review-seven.mjs`.

App now enables its Dashboard request hook only on Dashboard. The hook is always called (React hook ordering is unchanged), cleans up inactive requests, and keys requests by its own constraints plus recommendation settings, not unrelated global chat filters.

Checks: frontend typecheck and desktop/mobile `browser-review-seven.mjs` passed. The browser verifies zero `/api/plan` calls for Explore typing/submitted searches, refreshed Dashboard count after relevant changes, text/guidance-only Save preserving an in-flight chat and its filters (issue 4), and exploration/reset/discovery flows (issues 1/5). Both use the labelled simulated browser fallback; full backend/parity checks follow below.

## 7. Rust numerical scoring and selected-only explanations

Commit: `f368809`. Files: `backend/src/planner.rs`.

Separated fixed ranking facts and numerical scores from explanation rendering. An enum indexes the unchanged weight table directly. The candidate loop compares numerical scores and borrowed IDs, then builds detailed explanations only for winners. API response construction continues to reuse winning details and the same active topics.

Checks: 4 Rust optimization tests (including complete pre-refactor order/score/explanation/evidence cases and a selected-only detail-build counter), preference-related Rust tests and 31 exact shared comparisons passed. No score, tie-break or explanation baseline changes were needed for this optimization.

## Final verification

A final lifecycle regression also covers refreshing an older exploration snapshot without stored mode metadata: the continuation uses the same plan-building fallback as the request, avoiding an accidental mode change.

Passed after all seven fixes: frontend typecheck/build; full npm test (planner assertions, 182 TypeScript tests, 5 Wiki tests); Rust fmt/check/Clippy/build and all 35 Rust tests; API integration including 20 complete response fixtures; 31 exact shared fixture/goal/intent comparisons.

Focused browser checks passed on the compiled site: review-seven desktop/mobile flows (simulated fallback), Rust-backed ordinary/discovery/weekly-plan mode switching, desktop Rust/mobile fallback busy conflicts and explicit RSVP, and desktop Rust/mobile fallback proposal review/confirm/use-once/dismiss/deletion. Confirmed no hidden Dashboard POSTs during Explore searches, current preferences on re-entry, and no discarded chat response for a note/guidance-only Save.

Not verified against real IBM watsonx: live IAM/model availability, response latency and real model interpretation of transient exploration, discovery intent and retained constraints. The unchanged watsonx adapter and its local success/failure/safety mocks pass; these do not establish live model behavior. No real enrollment or institutional integration was tested. Full browser matrix and frozen evaluation were not rerun.

Scope: only the seven findings, their request continuations, regression tests/fixtures and documentation changed. No unresolved conflicts, dependency changes, main-branch modifications, pushes or PR actions. Separate issue commits above retain the review history; final verification includes the legacy-mode edge case.
