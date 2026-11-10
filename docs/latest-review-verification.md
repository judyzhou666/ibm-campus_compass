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
