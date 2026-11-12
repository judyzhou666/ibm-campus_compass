# Latest Doris review verification — November 10, 2026

This pass starts from `4bff78c`, after main synchronization and the previous review fixes. It changes Doris only. No push, main update, PR action, force-push or review resolution was performed.

## Completed findings

| Finding | Implementation and regression coverage |
| --- | --- |
| watsonx replacing deterministic mode/explore | `backend/src/lib.rs` overlays rule-selected policy onto accepted model constraints; local HTTP mocks deliberately return conflicting policy. Explicit exploration, plan intent, clarification, refresh, ordinary follow-up and reset are covered. |
| Schedule changes clearing chat context | `frontend/src/api.ts` separates recommendation-preference identity from full schedule/request identity. `frontend/src/App.tsx` resets conversation/skips on the former. Stale-result and latest-schedule checks still use the latter. Desktop/mobile browser tests add, cancel and remove an event while retaining clarification/skips. |
| AM/PM losing exploration context | `frontend/src/conversation.ts`, `frontend/src/interpretation.ts` and `backend/src/interpreter.rs` use explicit continuation and retain pending policy. A standalone recognized new request can leave clarification; existing partial/multiple-clock and generic-restatement guards remain. |
| Category/search mistaken for dismissal | `frontend/src/discovery.ts`, `frontend/src/types.ts`, `backend/src/model.rs` and both planners carry transient `view_excluded` separately. Exclusions apply before count/ranking. Validation bounds IDs/collection size. Diagnostics identify category/search and suggest changing those controls. Saved bookmarks/preferences are not changed. |
| Incidental explore overriding schedule construction | Both interpreters recognize leading schedule-construction intent before incidental explore vocabulary. The two reported sentences have exact frontend/backend parity checks. Existing compatible-schedule versus overlapping-alternative tests remain. |
| Magic continuation phrases | `continuationMessage()` and the conversation's special Find events rewrite are removed. `requestPlan`, the request hook, conversation actions and Rust `PlanRequest` use optional `continuation`. Ordinary requests end temporary beyond-interest exploration; reset always clears it. Refresh reuses each message's stored filters/mode with current preferences. |
| Unexplained offline no-match | `frontend/src/planner.ts` provides the same classification order and explanation strings as Rust. The API fallback includes this explanation alongside its honest simulated/offline notice. Exact cross-stack diagnostics are tested for category/search, dismissed and exploration-filtered cases. |
| Repeated App key/projection work | App memoizes the preference identity, settings display key and discovery projections, with dependencies on current immutable state. Schedule changes still update planner request identity; there is no stale global cache. |

## Changed files

- Runtime backend: `backend/src/lib.rs`, `backend/src/interpreter.rs`, `backend/src/model.rs`, `backend/src/planner.rs`.
- Runtime frontend: `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/src/conversation.ts`, `frontend/src/discovery.ts`, `frontend/src/interpretation.ts`, `frontend/src/planner.ts`, `frontend/src/types.ts`, `frontend/src/useRecommendations.ts`.
- Automated tests: `tests/backend-integration.ts`, `tests/exploration-lifecycle.test.ts`, `tests/recommendation-refresh.test.ts`, `tests/latest-review.test.ts`, `tests/preference-parity.ts`.
- Browser regression: `scripts/browser-latest-review.mjs` discovers the configured storage namespace and forces browser fallback explicitly.
- Documentation: `README.md`, `docs/backend.md`, this verification record.

## Checks actually run in this pass

| Command/check | Result |
| --- | --- |
| `npm test` | PASS: planner assertions, all **192 TypeScript tests**, **5 Wiki tests**. |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS: TypeScript checking and Vite production bundle. |
| `cargo fmt --check` | PASS. |
| `cargo clippy --locked --all-targets -- -D warnings` | PASS, no warnings. |
| `cargo build --locked` | PASS. |
| `cargo test --locked` | PASS: **37 Rust tests**, no failing binary/doc tests. Includes local watsonx/IAM mocks, deterministic continuation, existing validation and ranking fixtures. |
| `npm run test:api` | PASS: simulated Rust/browser parity, follow-ups, evolving clarifications, scheduling/RSVP validation, cancellations, request bounds, static serving and **20 exact complete baseline API responses**. |
| `node --import tsx tests/preference-parity.ts` | PASS: **40 exact shared comparisons** for constraints, IDs, scores and ordered reasons, plus empty-result diagnostics, actual simulated Rust conversation clarification/refresh/reset flows and server safeguards. Unknown/oversized view exclusions are rejected. |
| `scripts/browser-latest-review.mjs` | PASS at **1280px and 390px**, forced offline fallback: schedule add/cancel/remove preserves pending exploration clarification/session skips; structured continuation and main plan intent; no page errors. |
| Existing `scripts/browser-review-seven.mjs` | PASS at **1280px and 390px**: hidden Dashboard request suppression, current preferences, note/guidance saves preserving in-flight chat, exploration/reset and explicit discovery. |
| Existing `scripts/browser-discovery-fixes.mjs` | PASS: **1280px simulated Rust**, **390px fallback**; Academic fills result count, Explore/Saved dismissals work without changing bookmarks/preferences. |
| Existing `scripts/browser-preference-drafts.mjs` | PASS at **1280px and 390px**: dirty/partial inputs, Save guards, focus, discard confirmation, complete clearing/Cancel and added-entry Save. |
| `git diff --check` | PASS. |

Rust commands use `CARGO_HOME=/workspace/.cargo`, `RUSTUP_HOME=/workspace/.rustup` and the installed Rust bin directory on PATH. The Wiki fixture tests used the existing temporary rsync tools on PATH. No application dependencies were added.

Browser commands used `PLAYWRIGHT_MODULE=/tmp/sync-browser/node_modules/playwright/index.mjs`, `CHROMIUM_PATH=/usr/bin/chromium`, and `CAMPUS_TEST_URL=http://127.0.0.1:5183` with Vite and a simulated Rust server on port 4173. Existing scripts were run from temporary copies substituting only their hard-coded legacy storage namespace with the actual configured namespace; their assertions were preserved. The new browser regression reads `data/demo.json` itself. These browser-script namespace maintenance changes are not included as unrelated edits to existing scripts.

## Limits and remaining work

All eight reported findings are addressed in the scoped implementation and checks above. Existing ranking weights, tie-breaking, explicit RSVP/approval, real eligibility and schedule-conflict checks are preserved. Minimal payloads exclude raw notes and busy titles; canonical response naming remains `match_reasons`.

**No real IBM model access was used.** watsonx transport, authentication, model-response handling, policy preservation and labelled failures were tested through local mocks only. Real credentials, actual model interpretation quality and a live IBM deployment remain unverified. Run a separate credentialed integration task before claiming live verification.

The full browser regression matrix and frozen evaluation report were not rerun. The 20 baseline API response fixtures and existing automated regression suite were rerun. Preference resets and schedule changes are distinguished; full Refresh intentionally starts a fresh selection and clears conversation-local skips, while Show another/current-search follow-ups retain them. Existing explicit new-search/reset boundaries remain deliberate. No unrelated feature changes were introduced.

## Main integration — November 12, 2026

This record supersedes the November 10 execution summary for the combined branch. A normal merge incorporates main `346c3e54487f79ae32f8f637ed166957087de90b` into Doris starting at `31dc4b7c6a58cc35afd552ff1703e4d694c431a5`. No rebasing, force-push, main change or PR/review operation is used.

### Conflict resolutions

All **16 conflicted paths** were inspected individually:

| Path | Resolution |
| --- | --- |
| `backend/src/interpreter.rs` | Combine main's synonyms, free-admission/availability distinctions and tests with deterministic modes/exploration and structured continuation. Retain both test modules. |
| `backend/src/lib.rs` | Retain main's effective-update inputs, two-stage model extraction/ranking, profile coverage/disclosures, routes and attribution. Feed its ranker Doris's feasible scored batch, preserve deterministic mode/explore policy and return canonical structured reasons with ranked IDs. |
| `backend/src/model.rs` | Combine event metadata/update models and applied-update validation with preferences, participation, discovery mode and view exclusions. Bound profile context without rejecting valid Unicode. |
| `backend/src/planner.rs` | Keep deterministic preference ranking/count/mutual compatibility. Combine main's plain-language filter alternatives with accurate category/search, exploration and dismissal explanations. |
| `data/events.json` | Main owns all 48 records and current facts; retain existing authored participation fields by stable event ID. New records default participation to unknown, without title inference. |
| `evaluation/results.json` | Regenerate from the combined planner/catalog using unchanged frozen scenarios and hash; update its generated report together. |
| `frontend/src/App.tsx` | Retain main's pages, navigation, updates, welcome, notifications, calendar and planner controls. Combine Profile/Preferences/proposals, departure guards, transient skips, separate preference/schedule identities and historical-refresh UI. Remove the obsolete Dashboard recommendation hook along with main's intentional Dashboard section removal. |
| `frontend/src/Briefing.tsx` | Accept main's intentional deletion of the superseded Dashboard briefing; preserve preference-aware recommendations in Home and Planner. |
| `frontend/src/Pages.tsx` | Preserve main's Discussions implementation. Consolidate its major/goals/goal-type editing into the authoritative My Preferences editor, with explicit profile-model opt-in. Settings remains main's separate component. |
| `frontend/src/PlannerPanels.tsx` | Combine main narrative reasons/citations and readable evidence labels with Doris guidance, structured reasons and overlap information. |
| `frontend/src/api.ts` | Combine optional profile/update contracts, configured-model forwarding and explanations with exact-topic proposals, continuation, minimal busy payloads, canonical reasons and explanatory fallback. Saved profile context is empty unless opted in. |
| `frontend/src/components.tsx` | Preserve main's event-detail/access redesign, blocked-card details and catalog metadata; retain preference guidance and working transient dismissal actions. |
| `frontend/src/conversation.ts` | Preserve main fresh searches, chips, alternatives and update-driven replanning while retaining pending clarification, session skips, per-message filters/mode and safe refresh. Filter alternative cards through preferences/skips too. |
| `frontend/src/planner.ts` | Adapt the operation-local ranking/validation snapshots to main's effective event times/full/cancelled updates and optional event overrides; match Rust diagnostic semantics. |
| `frontend/src/state.ts` | Combine default fields and bounded migration. Preserve profile/preferences/plans/RSVP/chat and restore main's alternative/example message fields; never infer profile-model consent. |
| `frontend/src/types.ts` | Union compatible profile/preferences, event metadata/update, response/evidence and mode contracts. Keep local UI properties camelCase and the wire reason field snake_case. |

Related integration edits update consent controls/copy, Home preference handling, saved evidence decoding, responsive profile-card behavior, tests and API/design documentation. StudentProfile and studentProfile logic themselves remain unchanged from Doris. Main's watsonx runtime remains unchanged except test-fixture integration; a local two-stage mock was added for the combined route.

### Compatibility and consent

Saved major, free-text goals and main's four profile goal types remain supported by model ranking. An explicit checkbox plus Save in My Preferences enables that named context. Migration defaults the checkbox off, preserves old field values and does not promote notes into topics. Reflection/learning/biography remain outside automatic model requests. Revocation invalidates stale responses and stops future context transmission, but cannot retract prior calls. Direct API clients must have permission before sending main's explicit profile object; this demo adds no production consent registry or authentication.

Main's untouched Home retains its eight-card default mix. `preferencesConfigured` distinguishes an explicitly saved 1/3/5 preference count; older active Doris preference state migrates with its existing count. Home retains main's local major/goal keyword and goal-type behavior while incorporating enabled structured preference bonuses and practical/dismissal filters. Main's replacement of Dashboard briefing with News is intentional. The model can order/explain the feasible candidates; numeric `match_reasons` describe the deterministic candidate-selection stage, not inferred model scoring.

### Fresh verification

| Command/check | Result |
| --- | --- |
| `npm test` | PASS: planner assertions, **353 TypeScript tests**, **5 Wiki tests**. Covers all main and Doris test files. |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS: TypeScript plus production Vite bundle. |
| `cargo fmt --check` | PASS. |
| `cargo clippy --locked --all-targets -- -D warnings` | PASS. |
| `cargo build --locked` | PASS. |
| `cargo test --locked` | PASS: **79 Rust tests**, no binary/doc-test failures. Includes complete two-stage HTTP model/IAM mock, actual profile payload, cited AI narrative and canonical reason output, policy overrides/failures, updates and eligibility. |
| `npm run test:api` | PASS: **20 complete current-catalog API snapshots**, follow-ups/clarifications, conflicts/RSVP, cancellations, bounds and static serving. Original pre-refactor snapshots remain untouched and are tested against their archived 38-event catalog. |
| `node --import tsx tests/preference-parity.ts` | PASS: **43 exact shared comparisons** for constraints, IDs, scores/reasons and relevant empty-result diagnostics, plus conversation flows and server safeguards. New cases cover full/time-moved updates. |
| `npm run evaluate` | PASS: **20 frozen scenarios × 3 adapters**. Regenerated report/results; scenario expectations/hash unchanged. Not a live model evaluation. |
| `scripts/browser-main-sync.mjs` | PASS: **1280px simulated Rust / 390px forced fallback**. Welcome/brief setup, main pages/calendar views, profile persistence, saved profile consent/revocation and payload inspection, clarification/modes, RSVP, event updates/notifications and complete personalization clearing with plan preservation; no page errors or document overflow. |
| `scripts/browser-latest-review.mjs` | PASS at **1280px and 390px**, forced fallback: schedule add/cancel/remove preserves pending clarification/session skips, structured continuation and mode intent, no page errors. Entry label updated to main's Default Preference. |
| Existing `scripts/browser-student-profile.mjs` | PASS at **1280px and 390px**, fallback: missing/blank/persisted data, keyboard entry, five sections, Save/Cancel, discard warnings, focus, reload, Preferences route and no overflow. Executed a temporary copy adapting only storage namespace and main's explicit demo sign-in/welcome entry. |
| Active-source conflict-marker search; `git diff --cached --check origin/main`; scoped cached merge diff check | PASS: active source/data/tests contain no conflict markers or whitespace errors; all merge-index conflicts resolved before commit. |

Tools: existing stable Rust toolchain via `/workspace/.cargo` and `/workspace/.rustup`; existing temporary rsync tools for Wiki fixtures; Playwright at `/tmp/sync-browser/node_modules/playwright/index.mjs`, Chromium `/usr/bin/chromium`, production preview `http://127.0.0.1:4217`. No new application dependencies were added. Additional focused checks during conflict resolution found and repaired update-fullness attribution and alternative-card skip handling; final results above are reruns on the resolved code, rather than historical results.

**Remaining limits:** no genuine IBM credentials/model call, real enrollment, external calendar, production authentication or consent registry was verified. Model/IAM tests use local mocks. The full collection of every historical browser script was not rerun; the listed desktop/mobile journeys were run. The evaluation remains fictional and its frozen relevance expectations do not prove real recommendation quality. There are no known unresolved merge conflicts or failing required checks.

Archive note: checking the entire merge range from the old Doris head also reports pre-existing whitespace and literal conflict examples inside main's archived `bob_sessions/Judy/bob-tasks-ibm-campus_compass-2026-11-12.md` transcript and `.impeccable/critique` record. Both directories match origin/main exactly and are intentionally preserved. These are historical document contents, not unresolved merge-index entries or active-code conflict markers. The diff against main and scoped source/document/test checks pass.
