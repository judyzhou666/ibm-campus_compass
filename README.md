# Campus Compass

A classroom demo with a React/TypeScript frontend, Rust backend, explicitly labelled browser fallback, and fictional events for **October 19–23, 2026, America/New_York**. No real seat is reserved. The Rust server supports an optional configured IBM watsonx interpreter with labelled simulated fallback.

## Main synchronization verification — November 10, 2026

Fetched main `bcabf24` and Doris `c92dd79`. Remote Doris already contained main through merge `c92dd79` (parents `a946555` and `bcabf24`), so the clean local Doris checkout was fast-forwarded; merging origin/main then reported already up to date. No conflict resolution, history rewrite or application changes were needed. Previous review-fix commits remain ancestors, and their core planner, API, interpreter, preferences, profile and request-hook implementations are unchanged. Teammates’ forum, history, event-detail, timezone and expanded-catalog changes are preserved.

Fresh checks passed on the synchronized source: frontend typecheck/build, full npm test (planner assertions, 186 TypeScript tests, 5 Wiki fixtures), Rust fmt/check/Clippy/build and 35 Rust tests, API integration with complete response fixtures, and 31 exact TypeScript/Rust parity comparisons. Focused desktop/mobile browser checks passed for request counts and text-only saves, exploration/reset/discovery, student profile editing/persistence, explicit proposal confirmation/use-once/dismiss, and compatible-plan versus overlapping-discovery labels.

Browser verification used temporary copies of existing scripts with the current `storageKey()` substituted for their hard-coded legacy namespace; repository scripts and assertions were unchanged. Updating those scripts to discover the namespace is a remaining test-maintenance task. The configured demo week is now November 2–6, 2026, and its separate browser namespace intentionally does not restore the legacy October session; old stored data is not deleted. No live IBM watsonx account, full browser matrix or frozen evaluation was exercised in this synchronization.

Run locally with `npm ci`, `npm run build`, `cargo run --locked`, then http://localhost:4173. No PR state or review comments were changed.

## Doris synchronization with main bcabf24 (PR #8)

Merging main brought in PR #8's forum redesign, event-detail overlay, time zone setting, current-week calendar (Nov 2) and eight new fictional events (`e31`–`e38`). Conflicts were resolved as follows:
- `data/events.json`: main's 38 events, each keeping Doris's `participation` field. The new events use `"unknown"` because their records don't say how people take part.
- `components.tsx`: main's full-page EventDetails, with Doris's "Participation format" row added to the evidence list. Doris's EventCard and Week changes are unchanged.
- `Pages.tsx`: Doris's move of Profile into `MyPreferences` plus main's forum and settings changes. Only the imports actually used are kept.
- `state.ts` and `styles.css`: both sides combined; no CSS selector is added by both.

The new events change some planner results, so the pre-optimization snapshots were re-recorded without weakening them. The original pre-optimization TypeScript planner (`bcfb173`) and Rust binary (`89a405f`) were run on the merged catalog. They matched the current code exactly for all ids, scores, explanations, evidence and diagnostics; the only difference was the intended `match_reasons` field name. Only then were `tests/fixtures/planner-before-optimization.json` and `tests/fixtures/rust-ranking-before-optimization.json` re-recorded. The Academic discovery expectation is now `e1, e14, e31`, the same online and offline. Legacy posts now gain a stable `legacy-N` id on restore, and the migration test checks that.

Verification: `npm test` (186 TypeScript tests and 5 Wiki tests), `npm run build`, `cargo fmt --check`, Clippy with `-D warnings`, 35 Rust tests, `cargo build --locked` and `npm run test:api` all pass. The browser journeys and the frozen evaluation were not rerun.

## Seven follow-up review fixes (local Doris work)

Temporary beyond-interest exploration is one request at a time unless explicitly continued; ordinary messages restore saved-topic inclusion, and reset clears exploration/mode. Explicit discovery intent outranks incidental words such as “make friends this week.” Rust no-match diagnostics and comparison alternatives share dismissal/exploration exclusions. Request keys exclude local notes/profile text/guidance; note-only Save preserves active filters and pending responses. Dashboard requests are disabled off Dashboard through an always-mounted hook. Rust now scores numerical facts without formatting strings for unselected candidates; winners retain unchanged explanations and tie-breaking.

See [the per-issue implementation and verification record](docs/judy-seven-review.md) for exact commits, changed paths and checks. Fresh final checks passed: frontend typecheck/build, 182 TypeScript tests, 5 Wiki tests, planner assertions, Rust fmt/check/Clippy/build and 35 tests, API integration with 20 response fixtures, and 31 exact shared comparisons. Focused desktop/mobile simulated browser checks cover request counts, note-only saves, exploration/reset, mode switching, explicit RSVP/busy conflicts and preference confirmation. Live watsonx interpretation, the full browser matrix and frozen evaluation remain unverified in this pass. No push or PR action has been performed.

Demo locally with `npm run build`, `cargo run --locked`, then http://localhost:4173/#planner. Click **Explore beyond my interests**, then ask **Tuesday afternoon events**; saved interests are included again. **start over** clears mode/exploration. **explore social events to make friends this week** selects discovery; **build my weekly schedule** selects a compatible plan. Optional regression: `scripts/browser-review-seven.mjs` with the existing Playwright configuration.

## Final verification of eight review fixes

Verified on Doris: original per-message refresh filters (55f9950), supported-topic proposal interception (3c35dec), compatible default recommendation modes (4df2964), recommendation-only soft preferences (62bb746), honest missing profile facts (bcfb173), TypeScript ranking reuse (89a405f), Rust ranking reuse (00d2c18), and canonical `match_reasons` with legacy read compatibility (005e086). Main’s watsonx integration is retained through merge 8a2d021; no new application changes were needed for final verification.

Fresh pre-push checks passed: `npm run typecheck`, `npm run build`, full `npm test` (planner assertions, 175 TypeScript tests and 5 Wiki fixtures; rsync is a test prerequisite), `cargo fmt --check`, `cargo check --locked`, `cargo clippy --locked --all-targets -- -D warnings`, `cargo test --locked` (29 tests including local watsonx mocks), `cargo build --locked`, `npm run test:api` (including 20 complete response snapshots), and `node --import tsx tests/preference-parity.ts` (25 exact comparisons). No conflict markers or uncommitted application changes remained. Live IBM calls, the full browser matrix and frozen evaluation were not rerun in this final pass.

Run/demo remains `npm ci`, `npm run build`, `cargo run --locked`, then http://localhost:4173. Simulated mode needs no IBM credentials; optional watsonx configuration and visible fallback behavior remain documented in `docs/backend.md`. The existing review-specific sections below describe each fix and its demo/regression commands.

## Doris synchronization with main 6a2ab4b

The conflict in `backend/src/lib.rs` was resolved by combining main’s provider-aware `AppState`, live watsonx dispatch and deterministic safety precheck with Doris’s operation-local ranking batch. The response keeps main’s actual interpreter `mode`, `provider` and optional fallback `notice`, and adds exactly one canonical `match_reasons` field from the cached ranking details. Evidence reuses the batch topics. Health/config/plan/validate/enroll routes, body limits, static serving and explicit RSVP gates remain intact. Root `mode` identifies the interpreter (`simulated` or `watsonx`); `constraints.mode` independently controls compatible plans versus discovery.

Main’s watsonx adapter, model configuration, IAM/token handling, timeout/weekday parsing, startup, dependencies, Bob evidence scaffolding and Wiki changes are preserved. The frontend retains main’s mode/notice handling alongside the feature branch’s filters, preference safeguards, historical refresh snapshots, profile work and canonical-field adapter. No model protocol or live behavior was newly invented during conflict resolution.

Fresh verification: Rust formatting/check/build/Clippy, all 29 Rust tests (including main’s local watsonx success, failure and safety mocks), frontend typecheck/build, all 175 TypeScript tests, planner assertions, API integration with 20 complete response fixtures, and 25 exact shared comparisons passed. Mock handler checks additionally verify canonical match reasons for watsonx success, fallback and clarification responses. No live IBM request, full browser matrix or frozen evaluation was run in this merge verification. Start locally with `npm ci`, `npm run build`, `cargo run --locked`; optional watsonx configuration remains documented in `docs/backend.md` and `.env.example`. Older feature-stage integration status notes below are historical.

## Recommendation API field consistency

Rust `/api/plan` now emits `match_reasons`, with the same event IDs, scores and ordered explanation entries. It no longer emits the camel-case wire key. Response types, API reads, shared comparisons and captured response fixtures use the canonical name. React props, adapter results and stored chat `matchReasons` are intentionally unchanged.

Compatibility was checked against the in-repo optional-field contract: older frontend bundles can still plan, but may omit explanations until upgraded. The new adapter reads an older server’s `matchReasons` only when the canonical key is absent, and still accepts responses without explanations. Canonical data takes precedence and is validated even when a legacy alias is present. No scoring logic changed. See `docs/backend.md` for the contract and migration details.

Fresh verification: frontend typecheck/build, 174 TypeScript tests, Rust formatting/check/build/Clippy and 17 Rust tests, API integration with 20 response fixtures, and 25 exact Rust/TypeScript comparisons passed. The API tests cover both spellings, omission, canonical precedence and malformed canonical data; shared comparisons assert the server does not emit the old key. Browser journeys and frozen evaluation were not rerun for this field-only change.

## Rust ranking calculation optimization

Rust now returns an operation-local recommendation batch with the normalized active topics and each selected event’s computed score/matches. Feasible candidates are scored once per selection round, and tie comparisons borrow event IDs instead of cloning them. The HTTP response reuses winning details and the same active-topic snapshot for evidence; it does not rerun ranking for selected events. Existing event-only `recommend`, standalone `ranking_details` and `evidence` callers remain compatible. No state is cached across requests, and eligibility, scheduling, weights, diversity and tie-breaking are unchanged.

Before refactoring, 20 complete API responses were captured in `tests/fixtures/rust-ranking-before-optimization.json`. Rust tests check their order, scores, ordered explanations and evidence, plus standalone-helper equivalence, fresh preferences between calls and ordinal-ID/first-index ties. API integration compares the complete response bodies, preserving the public JSON contract.

Fresh verification: `cargo fmt`/`cargo fmt --check`, `cargo check --locked`, `cargo test --locked` (17 tests), Clippy with warnings denied, Rust build, frontend typecheck, API integration with the 20 baseline responses, and 25 exact Rust/TypeScript shared comparisons passed. Run `cargo test --locked ranking_optimization_tests`, `npm run test:api` and `node --import tsx tests/preference-parity.ts` after building. Browser journeys, full frontend tests and frozen evaluation were not rerun for this Rust-only refactor.

## Frontend ranking calculation optimization

Each recommendation operation now builds one normalized preference projection and one snapshot of planned/cancelled event IDs. Candidate validation reuses that context, and each feasible candidate is scored once per greedy selection round. Sorting compares stored scores; `recommendWithReasons` reuses the winning score and explanations instead of recomputing them. Active-topic and practical-preference helpers accept an optional projection while existing callers retain fresh normalization. Standalone validation still applies the same real eligibility and scheduling checks. Nothing is cached across user actions.

Behavior is locked against 20 cases captured from pre-refactor commit `bcfb173`: event order, scores, ordered explanation fingerprints, all-event scoring/validation diagnostics and the evaluation-only free-admission baseline match exactly. Additional instrumented tests check one migration/planned-ID scan per operation, one score per candidate per discovery round, and fresh results after in-place preference/schedule changes. No weights, tie-breaking, filtering or wording were changed.

Fresh verification: build/typecheck, planner assertions, all 171 TypeScript tests (including 23 optimization checks), API integration and 25 exact Rust/shared-fixture comparisons passed. Run `node --import tsx --test tests/planner-optimization.test.ts` for focused regression checks. Rust source is unchanged; Rust unit checks, browser journeys and frozen evaluation output were not rerun for this refactor.

## Honest profile defaults

Missing student status and university now default to empty strings, including older stored data without these fields. The card, overview and Basic Information show **Status not added** and **University not added**. Existing saved values (including explicitly supplied fictional demo values) are retained; the configured campus identity is no longer a silent personal-profile default. With no reliable provenance on older saved strings, the app does not guess whether they were entered by a user. Blank values remain blank when saved and reloaded. Profile editing, Save/Cancel and persistence reuse the same state flow; preferences and recommendations are unchanged.

Fresh verification: frontend build/typecheck, 7 focused profile tests and desktop/mobile profile browser checks passed for new/legacy data, saved values, blank/whitespace fields, missing-value labels, Save/Cancel and reload. Run `node --import tsx --test tests/student-profile.test.ts` and the optional `scripts/browser-student-profile.mjs` against the running site. No Rust or full application/browser suites were rerun for this profile-only change.

## Recommendation preferences versus explicit choices

Saved `free_only` and preferred availability windows filter recommendations in both Rust and TypeScript, but no longer veto explicit Add/RSVP or mark an already-planned event invalid. Recommendation scoring and filters are unchanged. Incoming recommendation responses also retain the preference check. The shared eligibility validator now checks only genuine validity, access/full/membership, cancellation, actual busy/planned conflicts and travel time; RSVP confirmation is still required when applicable.

To demo, enable **Recommend only free admission** and set a preferred window that does not include Wednesday evening. Recommendations omit the paid Ceramics beginner workshop (e29), but you may explicitly choose it from Explore if it passes real scheduling/access checks. Changing preferences after planning does not invalidate it. Adding an overlapping real busy commitment still creates a conflict, and adding another incompatible event remains blocked. Nothing is added automatically.

Fresh verification: frontend build/typecheck, planner assertions, 145 TypeScript tests, 14 Rust tests, Rust formatting/Clippy/build, API integration, and 25 exact shared comparisons passed. New checks cover explicit paid additions, outside-window RSVP, already-planned validity, true busy/plan conflicts, eligibility, and unchanged ranking/filtering. Rust API checks separately cover validation/enrollment and required RSVP. Run `node --import tsx --test tests/soft-preferences.test.ts tests/preferences.test.ts`, `cargo test --locked`, `npm run test:api` and `node --import tsx tests/preference-parity.ts` after building. The full browser matrix and frozen evaluation were not rerun. Older hard-preference descriptions below are historical and superseded here.

## Consistent recommendation modes

Ordinary Planner chat, Dashboard and the main briefing default to overlap-free plan-building, matching both planners when mode is omitted. Follow-ups and Show another retain an explicitly selected mode. Discover alternatives and explicit discover/browse/explore wording select discovery; the Across disciplines briefing and Explore outside my interests control also explicitly request discovery. Weekly-plan wording and Build weekly plan select plan-building. Schedule replacement uses plan-building with its existing one-result limit. Refresh preserves the selected message’s original mode (or an explicit override) and resolved filters with current preferences. Discovery options are labelled as alternatives, with named overlap warnings; they are never presented as a combined compatible schedule.

Both Rust and TypeScript retain the backward-compatible omitted-mode contract: mutually compatible recommendations. Only explicit discovery bypasses compatibility among the unplanned suggestions; existing commitments, plans, eligibility, travel buffers, budget/free-admission and other hard filters remain enforced. Scores, ranking and RSVP/latest-schedule gates are unchanged.

Fresh verification: build/typecheck; 140 TypeScript tests; 13 Rust tests; Rust formatting, Clippy and build; API integration; 25 shared-fixture/goal/mode comparisons plus Rust-backed ordinary-chat/weekly-plan/discovery and refresh checks; and the focused mobile mode-switch browser journey passed. The browser check covers an ordinary compatible search, named overlapping discovery alternatives, a compatible weekly plan and switching back. Run `node --import tsx --test tests/recommendation-modes.test.ts tests/recommendation-refresh.test.ts`, `cargo test --locked`, `node --import tsx tests/preference-parity.ts` and `npm run test:api` after building. Full browser matrix and frozen evaluation were not rerun.

## Chat proposal interception

Only explicit interest statements that `proposalTopic()` maps to supported topics open the preference proposal. Ordinary requests such as “Show me Friday events I'm interested in” and unsupported subjects continue to the normal planner; unrecognized interest wording stays in the input for correction and never opens an empty proposal. Supported use-once, review, explicit confirmation, dismiss and stale-proposal safeguards are unchanged.

Fresh checks: frontend build/typecheck; 73 proposal/preference/workflow tests; desktop/mobile proposal browser regression covering Friday search, unsupported input with a nonblank planner reply, unchanged preferences before confirmation, and the existing review/confirm/use-once/dismiss flows. Run `node --import tsx --test tests/preference-proposals.test.ts tests/preferences.test.ts tests/workflows.test.ts` or the optional `scripts/browser-preference-proposals.mjs` against the running site. No Rust/API integration or full browser matrix was rerun for this App-only behavior change.

## Recommendation refresh snapshots

Each new recommendation message stores a validated copy of its resolved search filters. **Refresh suggestions** reuses the selected message’s snapshot with current saved preferences and schedule, changing only an explicitly requested mode. It appends a new response and preserves other messages and their snapshots. Topic/day/time bounds, food/free-admission filters, exclusions, exploration and explicit result limits are retained. Historical filters survive browser reload even though global chat filters reset. Older messages without a valid snapshot ask for a complete restatement; refresh does not substitute current global defaults or guess missing requirements.

Fresh verification for this scoped fix: frontend build/typecheck and all 138 TypeScript tests passed, including Career on Tuesday after 3 PM → preference change → refresh, independent message refreshes, all supported filters, reload and legacy/invalid fallback. A focused browser check verified the selected historical Refresh suggestions button after reload and changed preferences, preserving the other message. Rust checks, API integration and the full browser matrix were not rerun. Run `node --import tsx --test tests/recommendation-refresh.test.ts tests/recommendation-presentation.test.ts tests/workflows.test.ts tests/api.test.ts` for the 80 relevant checks. No backend ranking or contract change is required.

## My Profile

The sidebar student card and header avatar open **My Profile** at `#my-profile`. The existing **My Preferences** route remains `#profile`. Profile uses the existing palette, typography, panels, buttons and initials avatar; no image upload or new app dependencies were added. On small screens, open the navigation menu for the card. Navigation can scroll above the card to keep **View Profile** accessible.

The profile page groups Basic Information, About Me, My Interests, Campus Involvement and My Activity. **Edit Profile** updates the shared demo display name and optional student status, university and short bio; Save persists through the existing browser demo state, while Cancel/navigation warn before discarding edits. The demo display name is reused, but missing status and university remain blank with explicit not-added labels. Saved and intentionally loaded fictional profile fields are preserved; no personal facts are silently inferred. Interests remain editable only through My Preferences. Joined communities, saved/planned events and demo RSVP counts reflect existing local state, not verified membership or attendance.

New optional `studentProfile` fields restore safely for older sessions. They are local browser data, not a public profile or backend account. Profile notes are excluded from existing recommendation payloads. Existing storage-unavailable feedback remains applicable; no cloud profile sync is implemented. Planners, recommendations, discussions and the My Preferences implementation are unchanged.

To test locally, run `npm ci`, then `npm run dev` and open http://localhost:5173/#my-profile. Choose **Use sample preferences** or **Skip for now** if first-time setup opens. Test Edit Profile → Save, reload, Cancel, declined navigation and the interests link. Vite can use the existing Rust service on port 4173; without it the existing labelled browser recommendation fallback applies. Alternatively run `npm run build` and `cargo run --locked`, then open http://localhost:4173/#my-profile.

Fresh verification for this frontend change: build/typecheck, planner assertions and 134 TypeScript tests passed. The focused browser regression at 1280px/390px verified card keyboard navigation, five sections, draft isolation, Save/Cancel, focus, reload persistence, discard warnings, the unchanged preferences route and no horizontal overflow. Run `node --import tsx --test tests/student-profile.test.ts`; optional Playwright check: `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CAMPUS_TEST_URL=http://127.0.0.1:5173 node scripts/browser-student-profile.mjs`. No Rust checks, live integration or full browser matrix were rerun for this profile-only change. Prior verification below is historical.

## First-time setup popup — October 23, 2026

The first-visit **Quick preference setup** popup now uses the browser's proportions instead of the shared 530px dialog width: 92% of the viewport width (up to 1440px) and 88% of its height on desktop. Direction/interests and participation/guidance appear side by side. Only the questions scroll; the early Skip action and bottom Save/open-full-preferences actions stay visible. Below 760px the questions stack, with 12px clearance around the popup. Existing selection, draft, Save and Skip behavior is retained.

This adjustment is scoped to the first-time dialog in `frontend/src/MyPreferences.tsx` and its `.quick-preference-dialog` CSS. The full **My Preferences** page (`#profile`), other dialogs, recommendation logic and Rust backend are unchanged. To inspect setup without resetting an existing demo session, use a fresh browser profile/private window with the normal local run instructions below.

Verified for this layout change: `npm run build`, `npm test` (127 TypeScript tests, 5 Wiki tests and planner assertions), and `git diff --check`. Browser inspection at 1280×900 and 390×844 confirmed the two-column/single-column layouts, no horizontal dialog overflow, and visible footer actions; changing and saving a setup choice persisted into the full preferences page. The full browser regression matrix was not rerun. That layout-only commit did not address the behavioral findings; the repair described below does.

## Review behavior repairs

Dashboard category and text filters now exclude nonmatching candidates before either planner applies the saved result count. Academic on fresh sample state returns e1/e14/e26 rather than filtering an already truncated list. The existing bounded dismissed-ID request field carries transient candidate exclusions; no new backend contract, ranking weights or persistent preferences were introduced.

Explore and Saved consume current-view skips for both Not for me and Show another. Hiding a Saved card leaves its bookmark intact. These view skips reset on navigation or saved-preference changes. Planner skips apply to every request in the current conversation search, including ordinary follow-ups and replacements. Explicit new searches (a supplied initial constraint set), start over/reset, refresh, new chat and preference-reset boundaries clear them. Follow-up time/topic refinements do not clear them. They are never saved as long-term interests or hidden-event choices.

Confirmed Clear personalization resets the entire editor draft, unfinished busy/window controls, baselines and validation errors, including when saved personalization was already empty. Saved busy commitments, hard requirements, plans and RSVP records remain.

Fresh verification for this repair: frontend typecheck/build, planner assertions, 130 TypeScript tests, 5 Wiki tests, and API integration (including Academic and retained chat exclusions through Rust and fallback) passed. Fresh focused browser checks on top of setup-layout commit ce7f756 cover desktop Rust/mobile fallback discovery controls, desktop/mobile editor clear, repeat-clear, draft/error reset and preservation, plus brief-setup keyboard/focus, Save/Skip and loading/error/retry. The setup layout/CSS is preserved. Run the optional scripts with the existing Playwright environment: scripts/browser-discovery-fixes.mjs and scripts/browser-preference-drafts.mjs after npm run build and starting the Rust service. No fresh Rust unit/Clippy, frozen evaluation, or full browser matrix was run; Rust implementation and ranking are unchanged. Earlier verification below is historical.

## Doris branch integration

Integrated the remote clarification-context fix while preserving the preference features and draft-entry repairs. Fresh merge verification passed: frontend build/type checking, planner assertions, 127 TypeScript tests, 5 Wiki tests, and Rust API integration. No new browser journey or Rust unit/Clippy run was performed for this merge. Run with the existing build/start instructions below; multi-part clarification must retain every unresolved requirement before returning suggestions. Existing fictional-demo and integration limitations remain unchanged.

## Draft-entry and navigation repairs

Unadded busy commitments and availability windows now count as unsaved edits. Save rejects incomplete entries with an accessible message and focuses the relevant field; Add stages an entry, Clear entry discards it, and Cancel resets both staged controls and the preference draft. Navigation warns before losing typed entries. The brand link prevents duplicate default navigation, so declining produces one discard prompt; modified clicks retain normal browser link behavior. The API integration expectation now uses plan-building for ordinary requests.

Fresh repair verification: frontend build/type checking, full `npm test` (117 TypeScript tests, 5 Wiki tests and planner assertions), `npm run test:api`, desktop/mobile draft-entry regressions and desktop-online/mobile-offline busy-conflict journeys passed. Browser regression: `scripts/browser-preference-drafts.mjs` with the existing optional Playwright environment. Rust unit/Clippy and frozen evaluation were not rerun in this repair; prior results below remain historical.

## Current preference flow

First-time setup is optional: **Save quick setup**, **Skip for now**, or open full preferences. It uses the same editor, draft and section components as **My Preferences** (`#profile`), not another preference store. Skipping preserves existing saved/sample choices. Dirty skipping/navigation requires confirmation. Full preferences remain available from navigation and **Using your preferences → Edit preferences**.

The five sections cover direction/interests, learning connections, participation/guidance, time/practical needs and personalization controls. Draft edits have no recommendation effect until Save; Cancel discards them after warning. Structured goals are used only when enabled. Learning notes never become matching topics automatically: select a supported topic, explicitly confirm it and Save. Manual/chat provenance remains visible. Counts 1/3/5 limit displayed suggestions, not attendance. Guidance offers concise information, one optional first step, a short checklist or known requirements/unknowns; optional preparation is not an official requirement.

A supported interest statement offers **This search only**, **Review and save**, or **Dismiss**. Review lists exact additions, existing provenance and every topic that will become enabled. Only confirmation changes saved topics. Unsupported/negated subjects offer manual selection. Saving/clearing preferences preserves plans, RSVP and conversations; old chat recommendations retain snapshots, receive previous-settings labels when relevant settings change, and offer Refresh suggestions. Deleted, dismissed and obsolete proposals/responses cannot restore preferences. **Not for me** and **Show another** are session-only; legacy saved hidden IDs remain explicitly restorable.

## Exact deterministic matching

The current-search topic set replaces saved topic defaults for that search. Otherwise the active set is the union of interests, enabled mapped goals and enabled confirmed learning topics. Current topics strictly restrict candidates; soft saved bonuses cannot widen that filter. Unknown/missing participation and all raw notes add zero points. For each feasible candidate, add each applicable bonus once:

| Component | Points |
|---|---:|
| Topic in current/active set | 10 |
| That topic is not yet represented in earlier suggestions | 4 |
| Enabled confirmed learning-topic match | 6 |
| Enabled structured-goal topic match | 3 |
| Enabled primary-goal topic match | 2 |
| Exact known participation-format preference match | 2 |
| Preferred time match | 2 |
| Free admission | 1 |

Goal IDs map exactly: `career → Career`; `practice` and `research → AI & education`; `people → Social`; `wellbeing → Wellbeing`; `discover`, `unsure`, `other → []`. Primary uses its selected goal's mapping. Time bonuses: morning ends by 12:00; afternoon starts at/after 12:00 and ends by 17:00; evening starts at/after 17:00. Ties use weekday, start minute, then ordinal event ID. A validated current count (1–5) overrides the saved 1/3/5 default. See [the full scoring, recognition and contract details](docs/preferences-design.md#exact-ranking-and-recognition-contract).

## Discovery, plans and busy time

`constraints.mode` is `discovery` or `plan-building`. Omission preserves legacy plan-building. Ordinary chat, Dashboard and main briefing use plan-building. Explicit exploration and the Across disciplines briefing use discovery; **Build weekly plan** selects plan-building. Follow-ups retain the selected mode and filters.

Discovery can return mutually overlapping **unplanned alternatives**. Actual overlaps/insufficient travel time are labelled by event title: these choices cannot both fit the schedule. Plan-building additionally checks mutual compatibility. Both modes enforce existing commitments and planned events, eligibility, cancellations, travel buffer, saved free-only/windows and current request filters. Numeric budgets are unsupported and explicitly rejected. Neither mode adds anything automatically; Add/RSVP always rechecks the latest schedule.

A newly entered busy commitment may conflict with an existing chosen event. Save names the conflicts and requires accessible browser-native confirmation. Accepting preserves the event and RSVP and marks the conflict in calendar/plan views; explicit removal remains available. Nothing is automatically removed, replaced or cancelled. Future suggestions exclude the busy time.

## Data, design rationale and limitations

State is plaintext `localStorage` under `campus-compass-demo-v1` for the default configuration; other campus/week/time-zone configurations get separate namespaces. Notes, provenance and history are local. Normal planner requests can transmit current message/validated constraints plus plan/cancellation IDs, interests, busy **times without titles**, buffer, preferred time and minimal structured preference fields. Raw preference notes, provenance, guidance, history/posts/memberships and snapshot identities are excluded. Use-once proposals send their exact mapped topics and validated filters with a generic message; copying private text into an ordinary planner message can still send that text. Processing is **not all on-device**: Rust handles requests when available; fallback is labelled. Clearing active personalization does not erase preserved chat or archived demo snapshots.

[SDT/BPNT rationale](docs/preferences-design.md#sdtbpnt-design-rationale) informs skip/control/consent (autonomy), manageable guidance (competence), and optional interaction formats/communities (relatedness). These are design choices, not psychological measures, diagnoses or demonstrated outcomes. Timetable data checks conflicts; it does not establish learning.

| Implemented | Unfinished or outside this demo |
|---|---|
| Shared versioned preferences/migration, consent, deterministic Rust/fallback matching, modes, grounded reasons/guidance, busy-conflict confirmation, local history/plans and ICS download | Arbitrary-language understanding, numeric-budget or strict location filtering, externally verified metadata, production privacy/authentication/database, real registration, SSO/Canvas/external-calendar connections, live watsonx |
| Focused parity and browser regression scripts | Exhaustive equivalence, cross-browser/full accessibility certification, real-student evaluation or measured SDT/BPNT outcomes |

## Run and short demo

```sh
npm ci
npm run build
cargo run --locked
```

For frontend development, run `npm run dev` alongside Rust. Use a separate private browser context for the demo so existing saved work is untouched.

1. Open full preferences. Clear interests, leave structured goals disabled, enter a learning note and observe that it adds no topic. Confirm **Career**, choose one suggestion and **A clear first step**, then Save. Switch to step-by-step guidance and inspect the optional checklist.
2. In Planner enter **“I'm interested in UX research now.”** Use once and inspect unchanged saved topics. Repeat, Review and save, inspect the exact broad AI & education addition/enabled list, then confirm. Unsupported **“I'm learning about quantum gardening”** offers manual selection.
3. Set count to **3** in full preferences and Save; ensure there are no added plans or extra availability windows yet. In Planner choose **Discover alternatives**, then enter **“events on Tuesday after 3 PM before 5 PM.”** `e1` (Learning with AI, 15:00–16:30) and `e17` (Student wellbeing circle, 16:00–17:00) overlap. Inspect labels, then choose **Build weekly plan**: it retains a compatible subset without adding anything.
4. Switch back to discovery and explicitly add `e1`, completing its demo RSVP. In full preferences add **Actual seminar**, Tuesday **15:00–16:15**. Decline Save's warning once, then confirm Save. Calendar still holds `e1` and its RSVP, now flagged; removal is explicit, and future suggestions exclude that time.

More precise prerequisites and expected results: [demo script](docs/preferences-design.md#short-reproducible-demo).

## Earlier documentation-pass verification

Application revision inspected: `2dd93ae` on `Doris`; application code was not edited in this task. **Newly run:** `npm run build` (including type checking); 60 focused TypeScript tests; `cargo fmt --check`; 13 Rust tests; Clippy with warnings denied; Rust build; 22 exact shared comparisons plus six server validation/RSVP/conflict checks. All passed. The exact focused command is recorded in [verification and remaining work](docs/preferences-design.md#verification-and-remaining-work).

**Not rerun in that earlier documentation pass:** the full npm/Wiki suite, broad API integration suite, frozen evaluation reproduction, and browser journeys. The subsequent repair reran npm/API and the specific browser journeys listed above. Earlier browser/check reports below are historical, not fresh results. Separate verification commands:

```sh
npm test
npm run test:api
npm run evaluate
```

Browser rerun commands and unverified behavior are listed in the design document. No check timed out; broader checks were left outside this focused documentation pass. No push, merge or deployment was performed.

## Historical implementation notes

The following records describe earlier commits and their checks, not current-task verification. Earlier limitations or unresolved-review notes may have been superseded by the current implementation above.

<details>
<summary>Earlier implementation and validation records</summary>

## Brief, skippable setup using the existing editor

First-time setup now renders the existing My Preferences editor and shared direction/interests, participation and guidance components in brief mode. There is no second form or preference store. Skip for now is prominent; Escape works, unsaved changes require discard confirmation, Save gives feedback, and full preferences remain available later. Keyboard focus starts at the dialog heading and returns to main content; mobile actions wrap within the existing styling.

Not for me now skips only the current discovery view/search and never silently changes long-term preferences. Existing saved hidden IDs are preserved until explicitly restored. Recommendation loading no longer shows false empty results, and Dashboard/briefing errors offer retry. Historical verification: frontend build/type checking, 35 focused tests, desktop-online/mobile-offline setup/action checks, injected loading/error/retry checks and both guided browser journeys passed. Existing RSVP approval, cancellation/replacement, archive/restore and export actions remain usable. Optional regression: `scripts/browser-brief-setup.mjs` using tooling from `docs/backend.md`. No decorative features or backend changes were added.

## Saving busy commitments that conflict with chosen events

My Preferences now previews newly introduced busy-time conflicts and requires browser-native confirmation on Save, checked against the latest planned events. Declining retains the unsaved draft. Confirming records the commitment while preserving the chosen events and RSVP records; nothing is automatically removed, replaced or cancelled. Calendar tiles, the Planner calendar and the plan list mark current conflicts. Existing details/Remove actions remain explicit student choices.

Both recommendation modes exclude the new busy time, and adding/confirming RSVP still validates the latest schedule. Busy titles remain local under the existing payload projection. Historical verification: frontend build/type checking, 59 focused busy/preference/workflow tests, diff checks and desktop-online/mobile-offline browser journeys passed. The browser check uses the actual demo RSVP flow, decline/confirm Save, conflict markers, explicit removal availability and reload preservation. Run `scripts/browser-busy-commitments.mjs` with optional tooling from `docs/backend.md`.

## Explicit pending preference proposals

Interest proposals now use a separate transient, one-shot controller. This search only preserves current filters and saved preferences; Review and save displays exact additions, preserved provenance and all topics that will be enabled; Dismiss saves nothing. Only confirmation updates saved topics. Confirmed changes preserve current search/hard constraints, plans, RSVP and conversations. Unsupported/negated statements offer manual selection rather than guessed understanding.

Dismissed, superseded, deleted and stale proposals cannot be confirmed or reused, including when preferences change and later revert. Navigation/new chat/new requests invalidate proposals; delayed search results cannot restore preferences. Historical verification: frontend build/type checking, 31 focused tests and desktop-online/mobile-offline proposal checks passed. The optional regression is `scripts/browser-preference-proposals.mjs`; see `docs/backend.md` for tooling. No backend/ranking change or integration was added.

## Discovery alternatives and compatible plans

The optional shared selection mode is now `discovery` or `plan-building`; omitted mode preserves the old compatible-plan behavior. Dashboard/briefing and ordinary Planner discovery can show mutually overlapping alternatives, clearly labelled by conflicting event title. Build weekly plan keeps suggestions mutually compatible; Discover alternatives switches modes without dropping filters. Both modes still respect commitments, existing plans, eligibility and hard constraints. Adding one alternative rechecks the current schedule and RSVP, so a conflicting partner cannot also be added. Historical chat retains its selection mode.

Historical verification: 13 Rust tests, fmt/Clippy/build, frontend build/type checking, 70 focused overlap/API/workflow/presentation tests, 22 shared comparisons and a mobile browser mode-switch check passed. The two planners agree on overlapping discovery versus compatible plan selection. All application callers were reviewed; no caller work remains. No push, merge, deployment, LLM or Python backend was introduced.

## Preferences across Dashboard, briefing and Planner

All recommendation surfaces now use the shared request path and show “Using your preferences” with Edit preferences. Cards, briefing, chat and draft suggestions render grounded matching explanations and selected guidance depth. Optional decision/preparation guidance is distinguished from the fictional catalog’s recorded requirements; no real registration workflow or missing event facts are invented.

Saving preferences refreshes Dashboard/briefing and invalidates obsolete requests. Plans, RSVP records and conversations remain. Chat retains validated reason/evidence snapshots across reloads, marks old suggestions as based on previous settings, and offers Refresh suggestions to append current results. Legacy messages without snapshots abstain from new-fit claims. Snapshot identities exclude raw notes and busy labels; these local history fields are never recommendation payloads. Clearing personalization preserves history; clear chat separately to remove it.

Historical verification: frontend build/type checking, 78 focused tests, desktop-online/mobile-offline surface checks, existing preferences journeys and full guided desktop/mobile journeys passed. Browser checks cover save/refresh/reload, historical labels, guidance, preserved plans/conversation, RSVP and cancellation safeguards, plus a delayed obsolete response. Run `scripts/browser-preference-surfaces.mjs` using the optional tooling described in `docs/backend.md`. No backend ranking or enrollment changes were needed; live watsonx remains deferred.

## Rust structured preference parity

Rust selection now uses its structured scoring explanation function and returns ordered wire `match_reasons` (adapted to local `matchReasons` in TypeScript): topic/diversity, enabled mapped goals/primary/confirmed learning, known participation, preferred time and free admission. Current-topic/limit behavior and hard constraints are preserved. The typed client validates reason codes, exact weights, totals and bounded collections, while accepting older responses without reasons. Goal IDs are projected once to validated topic arrays before requests; no title/note inference or duplicate mapping is introduced.

Historical verification: 12 Rust tests, formatting/Clippy/build, TypeScript type checking, 23 focused API/fallback tests and 18 exact shared-fixture/goal comparisons passed. Six server validation/RSVP/conflict checks also passed. Run `cargo build --locked` then `node --import tsx tests/preference-parity.ts`. No ranking/reason differences appeared in those canonical fixtures. Intentional differences remain in offline notices, Rust-only catalog evidence, local-vs-generic busy labels and malformed-input handling; see `docs/preferences-design.md`. No LLM, Python backend, push or deployment was introduced.

## Explainable TypeScript fallback scoring

The shared fallback recommendation path now produces structured local match reasons and exact point totals using saved interests, enabled goals/confirmed learning, known participation formats and preferred time. Existing weights are centralized without changing hard filters. Saved counts apply through the shared path; explicit request topics/limits replace only search defaults. Unknown metadata and raw notes add no score. Ties use weekday/start/ordinal event ID. These local explanations remain separate from Rust evidence. See `docs/preferences-design.md` for the exact score table, goal mapping and Rust parity contract.

Historical verification: TypeScript type checking, 34 focused fallback/API/preference tests and diff checks passed. Checks cover exact scores, switches, unknown metadata, note exclusion, hard constraints, current-search overrides, count propagation and order-independent ties. No full suites or Rust implementation changes were run for this fallback-only task.

## Minimal recommendation contracts

The frontend now names its v1 recommendation preference/schedule contracts. Requests exclude raw notes, provenance, browser-only guidance and busy-block titles; local schedule labels remain saved. Rust accepts new time-only blocks with a generic conflict label, as well as legacy labelled blocks and schedules without preferences. Existing enums/counts/collection bounds are validated, including oversized arrays and nonnumeric result counts. Optional event participation metadata explicitly supports Unknown; tests prove missing values are not inferred from titles. The existing authored event topic and structured-goal mapping suffice for goal matching, so no extra suitability metadata or fixture edits were needed. Ranking algorithms are unchanged.

Historical verification: frontend build/type checking, 31 focused API/preference/migration tests, 8 Rust tests, Rust formatting/Clippy/build and API integration passed. API regressions check old/new caller compatibility, collection limits and unchanged event selection. Service diagnostics for unnamed busy blocks use “Busy commitment”; the browser can still display its local labels. No integrations, logging or production infrastructure were added.

## Personalization controls and data boundaries

Goal/learning switches are saved draft choices: disabling excludes their structured topics without deleting them. Individual topic and bulk learning-data removal now require browser-native confirmation and remain drafts until Save; Cancel retains saved data. Clear personalization has a separate explicit confirmation and applies immediately, preserving plans, saved events, RSVP records, conversation messages, memberships, busy blocks and hard scheduling requirements. Current filters/draft suggestions reset. Guided-demo archives remain separate snapshots and can explicitly restore earlier preferences.

Privacy copy follows the actual allowlisted API: raw preference reflection/learning notes, major/free-text goals, provenance and conversation history are not automatically included. Current planner text, structured filters/preferences, plan/cancellation IDs, interests and busy commitment times (without titles) may reach the Rust service. Text explicitly copied into a planner message can be sent. Browser fallback is labelled; no all-on-device claim is made. Timetable data supports conflict checks, not inferred learning.

Historical verification: frontend type check/build, 15 focused preference/migration tests, desktop/mobile controls checks and the Direction/Learning regression passed. The request-capture regression asserts note/history exclusion from actual request bodies. Optional controls browser coverage: `scripts/browser-personalization-controls.mjs`, using the environment described in `docs/backend.md`. No integrations, logging, production infrastructure or ranking changes were introduced.

## Direction, Learning, Participation & Support controls

The existing draft editor keeps multiple structured goals, an optional selected primary goal, exclusive “Not sure yet”, interests and optional local reflection. Learning notes remain separate from confirmed topics: “Choose a supported topic below to use this in recommendations.” Confirming prepares a draft change; Save applies it. Re-confirming an existing topic preserves its manual/chat provenance, and removing a topic does not erase notes. No arbitrary-text understanding is claimed.

Participation supports multiple formats or exclusive No preference. Guidance is one of five choices and result count is 1/3/5. These optional controls update the unsaved summary and follow Save/Cancel. Count limits displayed suggestions, not attendance. No recommendation/ranking logic changed in this UI update.

Historical verification: frontend build/type checking, 14 focused preference/migration tests, and Chromium Direction/Learning and Participation/Support checks at 1280/390px passed. The optional scripts are `scripts/browser-direction-learning.mjs` and `scripts/browser-participation-support.mjs`; use the Playwright/Chromium environment described in `docs/backend.md` against a running built app.

## Preference editor shell safeguards

My Preferences remains the single full interest/time editor (`#profile`), reachable from navigation and the sidebar demo profile. The five existing sections and summary use an isolated draft; Save applies changes and Cancel asks before discarding edits. Browser-native confirmation protects internal navigation, global search and hash/back navigation; a standard before-unload warning protects reload/close where the browser supports it. The helper reads “Skip any question and change your preferences anytime.” No new section fields or ranking changes were added.

Historical verification: frontend type check/build and desktop/mobile Chromium shell checks (1280/390px) passed, covering draft isolation, Cancel confirmation, refusal to leave, hash/search navigation, Save/reload and before-unload registration. Run `scripts/browser-preference-shell.mjs` with the optional Playwright/Chromium environment described in `docs/backend.md`.

## My Preferences — October 23, 2026

My Preferences now replaces the old Profile editing form in navigation (`#profile`). It integrates direction/goals, optional learning notes and explicitly confirmed topics, participation/guidance choices, practical needs and personalization controls. Desktop has a live summary beside the editor; mobile stacks it above the form. The summary previews unsaved changes; only Save changes affects recommendations. Cancel discards edits. Quick setup is optional and supports general browsing.

Dashboard, Weekly Briefing and AI Planner share the Rust selection rules and labelled TypeScript fallback. Enabled structured goals and confirmed learning topics affect ranking, explicit fictional participation formats add a soft bonus, and guidance/count choices change presentation and result quantity. Preferred time ranks; entered busy commitments, travel buffer, saved free-only and available-only windows are hard checks. A current request can change the search topic, but cannot relax saved hard constraints. Unknown metadata is disclosed instead of inferred. No attendance target, competence score or belonging claim is made.

“I’m interested in UX research now” offers a disclosed broad-topic proposal: This search only, Review and save, or Dismiss. Only the exact confirmation dialog adds/enables a long-term learning topic. Raw reflection, major/goals, custom learning and location/format notes remain local and are not recommendation payloads. Existing interests, notes, plans, saved events, RSVP confirmations, messages and community memberships are migrated without inferred learning consent. Saving/clearing preferences preserves chosen plans and flags new conflicts. Clear chat is separate; active clearing does not purge an existing guided-demo archive.

The implementation keeps React/TypeScript and Rust/Axum/Tokio/Serde, with no Python backend or new application dependency. The added participation fixture fields are explicitly authored fictional metadata. Arbitrary notes are not semantically understood; unsupported text stays a note until the student chooses a supported topic. Numeric budgets, strict location filtering, live watsonx, institutional authentication and real calendar/Canvas integration remain unimplemented.

Run from the repository root: `npm ci`, `npm run build`, `cargo run --locked`; optionally `npm run dev` alongside Rust. Open My Preferences to test Save/Cancel, confirmed learning, disabled topics, guidance/count and narrow practical constraints. See [design, theory rationale and data flow](docs/preferences-design.md) for SDT/BPNT mapping and the five-step poster walkthrough. These are design hypotheses, not proven theory outcomes or a validated psychological scale.

Historical verification: planner/catalog assertions, 84 TypeScript tests, 5 Wiki tests, frontend type checking/build, Rust formatting/Clippy/build, 6 Rust tests and API integration passed. Chromium exercised the preferences flows at 1280px online and 390px with the API unavailable, including Save/Cancel/reload, consent, temporary searches, RSVP approval, hard constraints and note-payload exclusion. The existing guided demo journey also passed at both widths. The 20-scenario evaluation retains its metrics; raw evidence was refreshed for the new metadata and wording. Personalized behavior is covered separately by the new tests. No live watsonx or real enrollment was tested.

## Start here (teammates)

**New to coding? Use the [project Wiki](https://github.com/judyzhou666/ibm-campus_compass/wiki).** It has copy-and-paste, step-by-step guides:

| Wiki page | Use it to |
| --- | --- |
| [Getting started](https://github.com/judyzhou666/ibm-campus_compass/wiki/Getting-Started) | Install the tools, download the project and run the website on your own computer. No IBM key needed. |
| [Using watsonx](https://github.com/judyzhou666/ibm-campus_compass/wiki/Using-watsonx) | Optionally connect the AI Planner to IBM watsonx (Granite) with your own API key. |
| [IBM Bob](https://github.com/judyzhou666/ibm-campus_compass/wiki/IBM-Bob) | Set up Bob IDE and export your Bob sessions, which the lab requires from every teammate. |
| [Team workflow](https://github.com/judyzhou666/ibm-campus_compass/wiki/Team-Workflow) | Update your branch, save your work and open a pull request. |

Quick start, once Node.js 22.12+ and Rust are installed:

```sh
npm ci
npm run build
cargo run --locked
```

Then open http://127.0.0.1:4173. The chat label under AI Planner shows which planner answered: **Rust planner · Simulated** (built-in rules, the default), **Rust planner · IBM watsonx** (live Granite), or **Browser fallback · Simulated** (the server is not running).

## PR #8 review fixes — November 5, 2026

Fixes from the review of the forum redesign, event-detail overlay and time zone setting:

- **Create Post** now uses the community picked in its dropdown. Posts without one show as "Local demo post" instead of being filed under Campus explorers. Each post gets a stable id, so likes no longer move to another post when you add one. Posts saved before this change get ids when they load.
- **Save Draft** really saves the title, body and community in this browser, and Create Post reopens with the draft. Posting clears it.
- **Comments** are saved in this browser (up to 200) and appear in the thread and comment counts after reload. No message is sent.
- **Join conversation** is back on each post's detail page, and choosing a community shows its details panel again: topics, related fictional events, Join/Leave and Close. README's earlier manual join checks work again.
- **Time zone setting** now says exactly what it changes: the heading date, plus a "Starts … in your time zone" line in event details. Schedules, the planner and calendar export stay in campus time. A stored zone the browser doesn't recognize is ignored instead of blanking every page.
- **Back button / swipe-back** moves between tabs again and closes forum sub-pages. Only a Back press at the app's first page is absorbed, so you can't swipe out of the app.
- **Saved state** from the old Oct 19 demo week stays under the legacy storage key. The Nov 2 week starts with its own clean state, so old plans and RSVPs aren't moved onto new dates.
- **Event details** again moves focus to Close when it opens, keeps Tab inside the overlay, and returns focus to the event you opened when it closes.

Verification: `npm test` (88 TypeScript tests, including 4 new ones in `tests/forum-settings.test.ts`, and 5 Wiki tests), `npm run build`, `cargo fmt --check`, Clippy with `-D warnings`, 18 Rust tests, `cargo build --locked` and `npm run test:api` all pass. In the built app in a browser I checked: draft save and reopen, posting to a chosen community, a comment and a conversation join surviving in storage, Back across tabs and at the first page, and event-detail focus, Tab wrapping, Escape and the Tokyo time line. Limitations: forum likes still reset on reload, the editor toolbar and "Add tags" buttons do nothing yet, and the Rust planner is unchanged.

## CI fix — November 5, 2026: API integration expectation after new events

The "Rust and React checks" workflow failed on the `Judy` branch at `npm run test:api`. The November 2 catalog update added fictional event `e34` (Graduate school info night, Career, Tuesday 6:00–7:30 PM), which correctly matches the "career after 3" → "PM" / "after 3 PM" follow-up. Rust and the browser fallback both returned `e20, e34, e28`; only the test's hardcoded draft (`e20, e28`) was stale. Updated `tests/backend-integration.ts`; no application behavior changed.

Verification: `npm test` (planner assertions, TypeScript and 5 Wiki tests), `npm run build`, `cargo fmt --check`, Clippy with `-D warnings`, 18 Rust tests, `cargo build --locked` and `npm run test:api` all pass locally.

## Update — November 4, 2026: Doris's PR #4 merged with watsonx; teammate guides

`main` (Doris's PR #4: clarifications, recommendation evidence, demo configuration and evaluation) was merged into `Judy` together with the watsonx interpreter, then into `main`.

| Area | What changed |
| --- | --- |
| Planner API | `/api/plan` keeps Doris's `understood`, `clarification`, `recommendations` and `diagnostic` fields and adds `mode`, `provider` and the watsonx fallback `notice`. `/api/health` reports watsonx status; `/api/config` is unchanged. |
| Order of checks | The deterministic rules run first. Clarifications such as "Numeric budgets are not supported" never depend on the model. Only then is watsonx asked (in watsonx mode). |
| Unrecognised messages | As in Doris's design, a message the rules do not recognise at all (no interest, day, time, "event", "plan" or "week") is answered "I'm a limited demo planner…" in the browser and is **not** sent to watsonx. Most real requests contain one of these words. |
| Chat label | Doris moved chat logic into `frontend/src/conversation.ts`; it now shows the watsonx label too. |
| Teammate guides | The Wiki was rewritten for teammates without a coding background: new **Using watsonx** and **IBM Bob** pages, a step-by-step **Getting started**, and a simpler **Team workflow**. |

Verification on the merged code: Rust fmt, Clippy, build and 18 tests (including a new one confirming a numeric-budget request is answered by the rules without calling watsonx); 84 TypeScript tests and 5 Wiki tests; frontend type check and build; API integration. A live check with the team sandbox (`ibm/granite-4-h-small`) returned watsonx-mode suggestions on the requested Tuesday/Thursday with Doris's recommendation evidence, and the rules-based budget clarification. The Chromium browser journey from PR #4 was not rerun. The frozen evaluation results were not regenerated and do not cover watsonx.

## Update — November 4, 2026: optional IBM watsonx interpreter

The AI Planner can now use IBM watsonx.ai (Granite, Dallas `us-south`) to understand chat messages. It is **off by default**: without configuration the app runs the simulated planner exactly as before, and no credentials are needed.

| Change | What teammates should expect |
| --- | --- |
| Live interpreter option | Starting Rust with `PLANNER_PROVIDER=watsonx` makes `/api/plan` send the student's message and the previous filters to watsonx.ai. The model returns only search filters (topics, days, times, food, cost, number of options). The schedule, profile, names and chat history are not sent. |
| Trusted matching unchanged | Model output must be a JSON object with only known fields and must pass `Constraints::validate`. Rust's deterministic planner still picks every event, so the model cannot invent event IDs, eligibility or food. Adding an event still needs the student's click and a fresh validation. |
| Honest labels | The chat status shows **Rust planner · IBM watsonx** only when watsonx actually answered. If watsonx times out (6 s), rejects authentication, errors or returns invalid output, that request uses the simulated planner, the label reads **Rust planner · Simulated**, and the reply starts with "IBM watsonx was unavailable…". The offline browser fallback is unchanged. |
| Secrets stay on the server | The API key is read from the server environment, is exchanged for an IBM IAM token server-side, and never appears in API responses, logs or browser code. `.env` files are git-ignored. |
| Health endpoint | `GET /api/health` now also reports `watsonx_configured`. `watsonx_connected` is true only after the most recent live call succeeded. |

### Run with watsonx

```sh
cp .env.example .env    # then fill in WATSONX_API_KEY and WATSONX_PROJECT_ID
set -a; source .env; set +a
npm run build
cargo run --locked
```

The startup line says which planner is active. `WATSONX_URL` defaults to `https://us-south.ml.cloud.ibm.com` and `WATSONX_MODEL_ID` to `ibm/granite-4-h-small`, the Granite chat model offered in the lab's watsonx Challenge Sandbox. If your project lists a different Granite chat model, set its ID instead. Leave `PLANNER_PROVIDER` unset (or `simulated`) for the credential-free classroom demo. Details: [docs/backend.md](docs/backend.md#ibm-watsonx-interpreter).

### Implementation notes

- `backend/src/watsonx.rs`: `WatsonxInterpreter` (IAM token caching, `POST /ml/v1/text/chat`, JSON-only parsing, validation, timeout) and its mock-server tests.
- `backend/src/interpreter.rs`: the `Interpreter` trait now returns `Result<Constraints, InterpretError>`; `SimulatedInterpreter::parse` is the deterministic rules.
- `backend/src/lib.rs`: `Provider` selection, per-request labelled fallback, and `app_with(provider)`. `backend/src/main.rs` reads `PLANNER_PROVIDER` and refuses to start watsonx mode without `WATSONX_API_KEY` and `WATSONX_PROJECT_ID`.
- `frontend/src/api.ts`: accepts `mode: "watsonx"` and the server's fallback `notice`; `planModeLabel` drives the chat status label.
- New dependency: `reqwest` 0.13 (rustls, no OpenSSL). The local dev machine also needed a Rust toolchain installed via rustup for this work.

### Verification and limitations for this update

All checks listed under [Verification](#verification) passed on November 4, 2026 (Rust: 12 unit tests; npm: 10 API/fallback tests and 5 Wiki publisher tests; API integration suite passed). Rust tests run against a local mock IAM and watsonx.ai server and cover: valid output, fenced JSON, token reuse, IAM and chat authentication failures, upstream errors, timeouts, non-object or unknown-field output (such as `event_ids`), out-of-range constraints, key redaction, and the labelled fallback through `/api/plan`.

**First live run (November 4, 2026, team sandbox, Dallas).** The API key and project ID authenticated. Two problems surfaced and were fixed:

- `ibm/granite-3-3-8b-instruct` is not offered in the sandbox (HTTP 404). The default is now `ibm/granite-4-h-small`, the Granite chat model listed there.
- Granite numbered weekdays from Monday = 1, so "Tuesday or Thursday" became Wednesday and Friday. The model now returns weekday **names** and Rust converts them; numeric days from the model are rejected and the request falls back to the labelled simulated planner. Two new Rust tests cover all seven names and name-based follow-ups (14 tests in total).

After the fix, live answers were correct for "AI and a social event, Tuesday or Thursday only", "career events on Monday", "something on Wednesday or Friday afternoon", "weekend events" (no weekend events exist in the catalog) and "arts on Thursday" (none exist). Known differences from the simulated planner: Granite read "afternoon" as noon–midnight rather than noon–5 PM, and the follow-up "actually only Thursday" kept Thursday but dropped the earlier Social topic. The remaining prompts in `WATSONX-NEXT-STEPS.md` have not been run live. This change was written with Claude Code, not IBM Bob.

### IBM Bob lab requirements (added November 4, 2026)

A check against the lab guide found that the project does not yet meet the guide's mandatory Bob IDE requirement. To prepare:

- `.bobignore` keeps `.env`, keys and credential files (plus `node_modules/`, `target/`, `dist/`) out of Bob's context.
- `bob_sessions/README.md` explains how **each teammate** exports Bob task histories and consumption-summary screenshots into `bob_sessions/<name>/`. The folder contains no reports yet; only real Bob IDE exports belong there.
- `docs/ibm-bob-setup.md` now lists this evidence requirement and no longer says watsonx is deferred.

Still to do by the team: real Bob IDE work and its exported sessions, the 3-minute video, problem/solution and technology statements, and naming Campus Compass as your own challenge statement (education is not one of the listed themes).

## PR #4 final clarification review — October 22, 2026

Verified Doris’s multi-part clarification revision, then fixed one remaining partial-reply merge gap. Pending context now keeps every newly introduced clock bound, including ambiguous ones, carries forward safe topic changes, and promotes newly introduced weekday/location ambiguity to a full-restatement requirement. Unsupported day conditions never become a positive day filter. Partial answers generate no suggestions or calendar/RSVP changes until all pending requirements are resolved.

The fix is in `frontend/src/conversation.ts`. Shared `tests/clarification-fixtures.ts` cases run through workflow tests and the real Rust integration suite, online and offline. Examples include “career on Thursday after 3” → “before 5” → “PM”, and the same original request → “not Thursday after 3 PM” → “PM”: both remain blocked until a complete supported answer. A partial reply changing Career to Social also retains that topic change.

Validation: planner assertions, 83 TypeScript tests, 5 Wiki tests, frontend build/type checking, Rust formatting/Clippy/build, 6 Rust tests, real API integration and unchanged frozen evaluation results all pass. The independent targeted review found no further blockers. No visual interface or browser journey changes were made in this follow-up. Run the usual commands in `docs/backend.md`; use AI Planner to reproduce the sequences above, then supply a complete supported request or choose New chat.

## PR #4 multi-part clarification fixes — October 22, 2026

Clock clarification no longer hides an unresolved weekday exclusion or location condition. Mixed requests such as “social but not Tuesday after 3” now require a complete restatement with the topic, days the student CAN attend and explicit times. A reply of “PM” or “after 3 PM” cannot turn the excluded Tuesday into an allowed day. Rust and TypeScript mirror this policy and omit unsafe positively parsed days from mixed-ambiguity output.

For “career on Thursday after 3 before 5”, answering only “after 3 PM” or only “before 5 PM” keeps planning blocked and retains pending requirements. A complete answer such as “after 3 PM before 5 PM” resolves both bounds while preserving Career/Thursday. Even a new bound introduced by a partial reply must appear in the final restatement. Existing single-clock AM/PM resolution, new-chat/reset cancellation and explicit RSVP/calendar approval are retained.

The reviewer's `1544cc3` result-count fix and `9e52a88` invalid-date inspection fix are preserved. Validation: catalog/planner assertions, 73 TypeScript tests, 5 Wiki tests, frontend type check/build, Rust fmt/Clippy/build, 6 Rust tests and API integration passed. Actual online/offline conversation integration covers both partial-clock orderings, exclusions and proximity. Chromium passed eight online/offline mobile clarification journeys plus the complete 1280px/390px guided demo journey. The frozen 20-scenario report/results are unchanged; they are not a substitute for these multi-turn regressions. Run `npm ci`, `npm run build`, `cargo run --locked` and reproduce the quoted sequences in AI Planner; no calendar additions occur during clarification.

## PR #4 second review — October 22, 2026

Verified Doris’s original fixes: “career after 3” followed by “PM” or “after 3 PM” keeps Career filters, and explicit numeric budgets return no budget-filtered plan. Fixed a small regression in monetary detection: supported result-count requests such as “career up to 3 events”, “at most 2 options” and “no more than 1 choices” now retain their existing 1–5 result limits in both Rust and TypeScript. A count combined with “under $5” is still rejected as an unsupported budget. Changed the two interpreters and added offline/API parity regressions.

Validation passed: planner assertions, 61 TypeScript tests, 5 Wiki tests, frontend build/type checking, Rust fmt/Clippy/build, 6 Rust tests, API integration and reproduction of the unchanged frozen evaluation files. No browser journey was rerun for this parser-only fix. To check it manually, request “career up to 3 events” and then try the same request with “under $5”.

Two conversation revisions remain before merging: combined weekday/location ambiguity must not be lost when AM/PM is resolved, and a partial answer must not discard another unresolved clock bound. The review comments include “social but not Tuesday after 3” → “PM” and “career after 3 before 5” → “after 3 PM” reproductions. The single-request evaluation does not exercise these multi-turn cases.

## PR #4 clarification fixes — October 21, 2026

- AM/PM questions now retain non-ambiguous topic/day filters in pending conversation context. “career after 3” followed by either “PM” or “after 3 PM” produces only Career suggestions after 15:00. The ambiguous time is omitted from constraints until resolved; asking or answering a clarification never adds events or confirms RSVP. New chat/reset discards pending context. With multiple ambiguous times, a bare AM/PM answer requires a complete restatement rather than guessing.
- Numeric budgets are explicitly unsupported in both Rust and browser interpretation. “arts on Wednesday evening under $5” produces no suggestions and explains the supported free-admission option instead of silently returning the $12 ceramics workshop. Generic clarification no longer asks for a maximum budget; location/weekday questions request a complete restatement.
- Rust recommendation, comparison and no-match diagnostics now share the same constraint predicate. The reviewer's invalid-weekday detail fix (`9e52a88`) is preserved.

Validation: all required commands passed: catalog/planner assertions, 60 TypeScript tests, 5 Wiki tests, frontend build/type checking, Rust fmt/Clippy/build, 6 Rust tests, and API integration. Integration also runs actual online/offline conversation follow-ups. Chromium verified both AM/PM answer forms and numeric-budget rejection online/offline with no calendar additions. The frozen 20-scenario report/results remain unchanged; follow-up regressions are separate from that single-request evaluation. Run with `npm ci`, `npm run build`, `cargo run --locked`; in AI Planner try the quoted requests above. No live watsonx or real enrollment is claimed.

## PR #4 review follow-up — October 19, 2026

Fixed an invalid-date inspection crash: Team Data Review can flag a record with an out-of-range or fractional weekday, and opening it now shows “Unknown day, Date needs review” instead of throwing a date-formatting error. `frontend/src/config.ts` guards weekday formatting, `frontend/src/data.ts` keeps the label readable, and `tests/final-alignment.test.ts` covers invalid weekdays plus an unchanged valid date. No catalog records were modified.

Review verification: planner assertions, 50 TypeScript tests, 5 Wiki tests, frontend type checking/build, Rust formatting/Clippy/build, 6 Rust unit tests and API integration passed. Re-running the 20-scenario evaluation reproduced the committed report and raw results without differences. The date fix was checked through formatting/regression tests; the previously documented Chromium journey was not rerun for this review.

Two clarification revisions remain for Doris before merging: retain the requested topics/day when resolving an AM/PM question, and either implement maximum-budget filtering consistently in Rust/TypeScript or ask only for supported free-admission requirements while rejecting unsupported budgets. Reproductions and suggested acceptance checks are recorded on PR #4. The current synthetic evaluation does not exercise these follow-up conversations.

## Final proposal alignment — October 19, 2026

This iteration refines the existing MVP rather than recreating onboarding, communities, briefing or enrollment. Backend services and future watsonx integration remain Rust/Axum/Tokio/Serde; frontend source remains React/TypeScript built to JavaScript with Vite. No Python backend, real registrations or live university/IBM services were added.

- **More balanced planning:** diversity-aware ranking covers expressed topics when feasible; strict cost/time/access/travel filters remain authoritative. Evidence includes trusted-record comparisons, topic/category discovery context, satisfied filters and remaining trade-offs. Free-text major/goals are explicitly not interpreted.
- **Clarification and honest empty states:** ambiguous location/cost, weekday exclusions and AM/PM prompt questions. Unsupported requests, no catalog matches, conflicts, participation restrictions and missing requirements have distinct responses.
- **One demo configuration:** edit `data/demo.json` for fictional campus identity, Monday week start and IANA time zone; rebuild both sides. Dates and ICS UTC timestamps follow the configuration. Another campus/week/zone uses a separate storage namespace, preserving earlier local plans.
- **Team review:** Settings → Team tools → Open synthetic-data review shows counts/filters for missing sources/URLs, missing/stale verification, unknown access/RSVP/food and invalid metadata. It is read-only and never fabricates a source or verification claim.
- **Guided journey:** AI Planner → Demo Scenario Launcher prepares a fictional graduate profile and limited availability, then keeps recommendations, cancellation, replacement and export in one workflow. Prior state is archived once; additions and RSVP always require student action. Restore previous demo returns to the archive.

### Measured value and limits

Run `cargo build --locked` then `npm run evaluate` from the repository root. It measures 20 frozen synthetic scenarios (12 development, 8 held-out) across keyword/category search, deterministic rules and the actual Rust context planner. Raw outputs and denominators are saved in `evaluation/results.json`; [the generated report](docs/evaluation-report.md) includes failure cases and [metric definitions](docs/evaluation-methodology.md).

The context planner has zero measured conflict/eligibility violations on this suite and improves development topic coverage over chronological rules. The rule baseline ties it on held-out retrieval/coverage. This is a small visible synthetic benchmark, not proof of live AI value, external source truth, user benefit or generalization. Template explanation checks are not human usefulness ratings. **Live watsonx: Not yet evaluated.**

Verified on this revision: all seven required commands passed, including 49 TypeScript tests, 5 Wiki fixture tests, 6 Rust unit tests, frontend build/type check, Rust formatting/Clippy/build and API integration. The 20-scenario × 3-adapter evaluation reproduced byte-identical report/result files on two runs. The checked-in Chromium journey passed at 1280px and 390px, covering manual RSVP/replacement approval, ICS, archive restore, clarification, review filters and seven-view overflow. No real student or organizer research is claimed.

Run locally with `npm ci`, `npm run build`, `cargo run --locked`; use `npm run dev` alongside Rust for frontend development. Follow [the three-minute demo script](docs/demo-script.md). [The proposal checklist](docs/proposal-alignment.md) maps implemented, partial, missing and out-of-MVP requirements and lists student/organizer research still needed. The original proposal document was unavailable in the workspace, so alignment uses the supplied requirements.

## Integrated update — October 18, 2026

The architecture changes are merged with the latest teammate discovery, evidence, personalization and community work. Conversation ownership retains strict replacement filters and preserves Rust evidence in chat; preferred-time changes invalidate pending suggestions. Weekly briefing and targeted community navigation remain available. Engineering skills now use GitHub Issues, default triage labels and the domain conventions in `docs/agents/`.

### Doris synchronization — October 19, 2026

Doris incorporates main at `cfe617a` without conflicts, preserving the latest community fixes and workflow refactoring. The backend remains Rust/Axum/Tokio/Serde, including the future watsonx interpreter interface; the frontend remains React/TypeScript compiled to JavaScript. No tracked Python files or Python dependency manifests are present, so no additional language migration was needed.

Validation after synchronization: catalog/planner assertions, all 43 TypeScript tests, 5 Wiki fixture tests, frontend type checking/build, Rust formatting, Clippy with warnings denied, 4 Rust unit tests, Rust build and API integration passed. Run with `npm ci`, `npm run build`, and `cargo run --locked`; use `npm run dev` alongside Rust for frontend development. Live watsonx remains deferred and requires a Rust adapter; the current planner and all registrations remain explicitly simulated.

## PR #3 review fixes — October 18, 2026

Two community interaction bugs found during review have been fixed on the PR branch:

- Community memberships now persist in `joinedCommunities`, independently of conversation joins in `joined`. A conversation named `ai` can no longer join or leave the AI community accidentally. Existing conversation joins remain intact. Legacy `joined` values are not inferred as community memberships because post titles can match community IDs; rejoin any groups tested on the earlier PR preview once.
- Related-community links in event details now carry a validated community ID, such as `#forum?community=ai`. They open the selected group's details, scroll it into view and move keyboard focus there. Reloading or using Back/Forward retains the group in the URL. Unknown IDs safely show the general forum.

Files changed for these fixes: `communities.ts` (membership operations and community links), `state.ts` / `types.ts` (separate persisted membership field), and `App.tsx` / `Pages.tsx` / `components.tsx` (selected-community navigation). `tests/communities.test.ts` covers name collisions, persistence and valid/invalid links.

Historical verification: `npm test` passes the planner assertions, 18 TypeScript tests and 5 Wiki tests; `npm run build` passes. The reviewed Rust code passes its 4 unit tests and API integration suite. Browser checks verify named event-to-community navigation, independent conversation/community joins and leave actions, reload persistence, and a 390px mobile layout without horizontal page overflow. To reproduce the collision regression check, create a local post titled `ai`, join its conversation, and confirm **AI & learning circle** still offers **Join locally**. Join and leave that community; the conversation must remain joined.

## Proposal-aligned MVP improvements — Doris

The Rust planner now returns structured recommendation evidence: interest relevance using the event description, schedule fit including travel buffer, practical requirements, and trade-offs. Chat cards display backend evidence; unavailable-backend suggestions carry an explicit browser simulation notice and do not invent Rust evidence. Evidence describes the recommendation-time snapshot; add actions always check current availability again. Reloaded chat retains event links but does not restore evidence as fresh verification.

Event details now show campus identity, intended audience, eligibility, capacity/availability, food category, source URL, last-checked timestamp and verification status. All 30 records remain fictional. External source URLs and check timestamps are deliberately absent, displayed as Unknown / Not verified. The existing `checked` date records internal authoring review only. Open access in a fictional record does not establish real university eligibility or available seats.

Dashboard **This Week's Briefing** uses deterministic planning for interest and cross-topic suggestions, lists saved-but-not-added events, highlights uncertainty and current plan conflicts/cancellations, and links to details, Planner and Calendar. Cross-disciplinary means topics beyond selected interests; verified department information is unavailable. The digest updates from local state, never background scraping.

First-time demo users can personalize or use sample preferences. Profile supports optional major/interdisciplinary notes, optional research/career goals, academic/social/cultural topic selections and preferred times. Topic selections and preferred time affect ranking; free-text notes are stored locally but are not semantically interpreted. Busy commitments and travel buffer remain editable. A career goal is never required.

Discussion Forum includes searchable **All Communities**, category filters, individual details, local Join/Leave states, and topic-related events. Event details link to matching fictional communities. Posts and memberships stay in this browser; nothing is sent to other students.

Cancellation replanning identifies the cancelled record, names retained choices, shows a replacement with evidence and RSVP requirements, and never adds it automatically. It preserves all existing filters. If those cannot be satisfied, it lists them and asks the student to change day/time, food or topic explicitly; it does not silently relax constraints.

### Run and manually check this update

From the repository root: `npm ci`, `npm run build`, then `cargo run --locked`. For frontend development, also run `npm run dev`. Rust serves the built frontend and API; see [backend setup](docs/backend.md).

1. In a fresh browser profile (or Settings → Reset demo), select **Personalize my demo**. Choose topics and a preferred time; leave career goals blank. Save and reload to check persistence.
2. On Dashboard, inspect **This Week's Briefing**, saved events, uncertainty notices and the links to details, Planner and Calendar.
3. In Planner, choose the AI Tuesday/Thursday afternoon prompt. Inspect interest, schedule, practical and trade-off evidence; open details and verify fictional source labels and Unknown / Not verified fields.
4. Add the learning lab: cancel RSVP once and confirm nothing is added; then enter a fictional name, approve attendance and complete RSVP. Confirm calendar updates, reload persistence and calendar export.
5. Hide the planner calendar if needed, simulate cancellation, and select **Find a replacement**. Check that other choices remain, the cancelled record is removed, and the replacement stays a suggestion until explicitly added. For no-match behavior, request AI on Tuesday after 3 PM before 4:30 PM with coffee before finding a replacement.
6. Open Discussion Forum. Search Global, filter categories, open community details, Join/Leave, and create a local post. Event details also link to related communities.
7. Check keyboard Tab/Escape, dialogs and navigation, and desktop/tablet/mobile layouts. Disconnect the backend to verify explicitly labelled browser fallback and absence of fabricated backend evidence.

### Verification and limits

All required commands passed: `npm test`, `npm run build`, `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, `cargo test --locked`, `cargo build --locked`, `npm run test:api`. Node runs catalog/planner assertions, 15 API/preference/replanning tests and 5 Wiki fixture tests; Rust runs 4 unit tests. API integration covers new evidence, preferred-time parity, eligibility, RSVP, validation and static boundaries.

Headless Chromium checks covered onboarding, preferences, briefing, evidence, provenance, RSVP cancel/approve, communities and persistence, plus overflow checks on six pages at 1280/820/390px. These checks are smoke tests, not a full accessibility audit. The app remains a browser-local simulation with fixed October 19–23, 2026 data; no live watsonx, production authentication, real registrations, external calendars or verified university sources are implemented.

## Architecture update — October 18, 2026

Enrollment, planning conversations and request interpretation now own their rules in separate modules. This keeps the calendar beside chat and mandatory demo RSVP flow while making asynchronous behavior testable through the same interfaces the UI uses.

| Change | What teammates should expect |
| --- | --- |
| Enrollment ownership | One module owns RSVP gating, pending additions, current-schedule checks and calendar/RSVP updates. Reset discards obsolete confirmations and errors; removing an event clears its RSVP. |
| Conversation ownership | Chat and replacement share request validity and busy-state handling. New chat/reset discard old results; changed schedules reject outdated suggestions. Replacement preserves every filter until the student explicitly changes it. |
| Consistent interpretation | “Professional”, “ceramics”, “balance”, “snack” and “refreshment” reach the interpreter. Rust and browser simulation distinguish unsupported requests from understood requests with no matches, and reject invalid clock input such as “before 11:99 am”. |
| Calendar beside chat | The **My calendar** button at the top right of AI Planner toggles a calendar panel on the right without leaving the conversation. It replaces the draft sidebar while open. On narrow screens it stacks below chat. |
| Actions in AI responses | New recommendation messages contain event cards with **View details** and **Add to calendar** buttons. Added events show a disabled confirmation button. Unavailable events show the reason. |
| Mandatory RSVP | Adding an event marked **RSVP required** opens a registration dialog. A demo attendee name and an explicit attendance checkbox are required before **Complete RSVP & add** can succeed. Cancelling or pressing Escape leaves the calendar unchanged. |
| Automatic calendar updates | A successful addition immediately updates the planner panel, dashboard and main calendar. Drop-in events can be added directly. Removing an event also clears its demo RSVP confirmation. |
| Shared enrollment validation | Every Add entry point—chat, draft plan, dashboard, Explore Events and event details—uses the same flow. Rust and the offline TypeScript fallback both enforce RSVP and current availability. |

The registration dialog is a **demo RSVP page** inside the app. It does not contact an organizer, reserve a real seat, charge a fee, or send a confirmation email. Use a fictional display name. There is no external registration website or live calendar integration.

### Implementation notes for the team

- `frontend/src/PlannerPanels.tsx` contains the chat event cards, side calendar, and RSVP form.
- `frontend/src/enrollment.ts` owns approved additions and removal, including latest-schedule validation and reset invalidation. `frontend/src/conversation.ts` owns chat and replacement lifecycle; suggestions never add events automatically.
- `frontend/src/App.tsx` renders views and handles navigation, notifications and dialogs. It subscribes to shared demo state and read-only workflow status through `useSyncExternalStore`.
- `frontend/src/interpretation.ts` owns browser request recognition, parsing and constraint validation. The Rust interpreter returns constraints plus recognition status; `POST /api/plan` now includes `understood`. Rebuild frontend and backend together.
- `frontend/src/api.ts` sends enrollment requests and supplies the explicitly labelled offline simulation. Backend request rejections are never treated as offline success.
- `backend/src/lib.rs` exposes `POST /api/enroll`. The Rust event model reads each record’s RSVP requirement from `data/events.json`; the client cannot override it.
- Browser-local state now records confirmed demo RSVP event IDs and event IDs attached to new chat responses. Existing saved schedules are preserved. Old chat messages remain readable but do not gain buttons retroactively; send a fresh prompt to see the new cards.
- `tests/workflows.test.ts` exercises complete enrollment and conversation outcomes with controlled request completion. Domain terms are documented in `docs/GLOSSARY.md`.

## Run locally

Install Rust stable and Node.js 22.12+. From the repository root:

```sh
npm ci
npm run build
cargo run --locked
```

Open http://127.0.0.1:4173. Rust serves the React/TypeScript frontend and planning API. For frontend development, run `npm run dev` alongside Rust. Python is not required.

See [backend architecture and test commands](docs/backend.md) and [IBM Bob setup](docs/ibm-bob-setup.md). Step-by-step guides for teammates, including optional watsonx setup, are in the [project Wiki](https://github.com/judyzhou666/ibm-campus_compass/wiki).

## What works

- Dashboard, event search and category filters, saved events, details and record provenance.
- Simulated conversational planning over 30 original fictional events in a fixed October 19–23, 2026 demo week, America/New_York time.
- Interest, weekday, morning/afternoon/evening, before/after, free-admission, and meal/refreshment constraints.
- Existing class/commitment and chosen-event conflict checks, including an optional 15-minute travel buffer.
- Ineligible, unknown-access, full and cancelled events excluded from plans.
- Student-approved additions, calendar removal, .ics export, and a cancellation/replacement loop.
- Editable interests and busy commitments. Local-only sample discussion board.
- Browser-local persistence and Settings → Reset demo.
- Responsive layout, reduced-motion support, labelled inputs, keyboard focus, and native event-details dialog.

## Suggested three-minute walkthrough

1. Start at Settings → Reset demo. Show the dashboard and the sample weekly classes.
2. Open AI Planner. Select “AI and education on Tuesday or Thursday afternoons.”
3. Show the two matches, their times, and the reasons. The Tuesday research roundtable is excluded because it overlaps a sample class.
4. Click the planner’s top-right **My calendar** button. Chat stays visible with the calendar on the right. In the response, inspect **View details**, then **Add to calendar** for “Learning with AI: a hands-on lab.” Cancel the RSVP once to show that no event is added. Open it again, enter a demo name, check the attendance box, and select **Complete RSVP & add**. The event appears immediately with “Demo RSVP confirmed.”
5. Close the calendar panel to return to the draft sidebar. Select Simulate event cancellation → Find a replacement. The Thursday open studio is offered; other confirmed choices are retained.
6. Add the replacement (a drop-in event, so no RSVP form). The side calendar opens automatically. Open My Calendar from the main navigation to export the calendar. Cancelled records are excluded and exported titles are marked [DEMO].
7. Select “A social event with free food.” Example prompt buttons begin a fresh request; typed follow-ups retain prior filters. Show that free meals and coffee/snacks are distinct.
8. Close by stating the limitations: fictional data, simulated chat by default (watsonx optional and not yet verified live), no external calendar connections.

## Current boundaries

By default this version uses a Rust deterministic parser and template responses, with a labelled TypeScript fallback when the backend is unavailable. An optional watsonx.ai interpreter can replace the parser for understanding requests (see the latest update), but replies are still templates and events are still chosen by deterministic rules; it is not a general-purpose chatbot. Ambiguous natural language and unsupported constraints may not be understood; use the example prompts for the demo. “Start over” clears prior chat filters. It does not create real RSVPs, send messages, or sync calendars. Local discussion posts are not shared. Data is fixed, not live or fetched daily. The institution and business outcomes in the proposal remain hypotheses.

IBM Bob is a development assistant. This implementation was created in Codex and is not evidence of IBM Bob use. Your team should perform and document genuine Bob-assisted development/testing before describing the course's Bob component as fulfilled. The watsonx interpreter was added with Claude Code on November 4, 2026; it is not evidence of Bob use either.

## Files and extension point

- `backend/src/`: Rust Axum API, simulated and optional watsonx interpreters, schedule validation and event matching.
- `.env.example`: server-side watsonx settings template (copy to git-ignored `.env`).
- `.bobignore`: files IBM Bob must not read. `bob_sessions/`: exported Bob task reports required for judging.
- `frontend/src/`: React/TypeScript UI, typed API calls, local persistence, calendar export and explicit browser simulation fallback.
- `data/events.json`: shared catalog of 30 fictional events.
- `frontend/public/assets/mascot.png`: unchanged supplied mascot.
- `dist/`: generated build output, ignored by Git.
- `tests/` and `test.mjs`: API, fallback, scheduling and Wiki publisher checks.
- `WATSONX-NEXT-STEPS.md`: live watsonx verification checklist.

## Data and assets register

All 30 event records were originally authored for this prototype. No campus websites, personal calendars, social media, confidential records or real student data were ingested. Event locations, communities, and discussion participants are fictional. Dates use a fixed demonstration week.

The cat image was supplied by the user for this website and is used unchanged. Its original third-party authorship/license has not been independently verified. Before public distribution beyond the team's intended demo, the team should record the original asset provenance/permission. No external images or fonts are loaded. Compass and interface icons are original SVG geometry; poster panels are original HTML/CSS typographic artwork.

Names in the team credit were supplied or inferred from the user's account context. Demo profile fields are editable and are stored only in the viewer's browser.

## Verification

Run these from the repository root before sharing application changes:

```sh
npm test
npm run build
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo build --locked
npm run test:api
```

October 18 verification: all seven commands above passed, including 43 TypeScript tests, five Wiki publisher tests, the planner assertions, four Rust tests and the expanded Rust/TypeScript integration suite. Browser checks reported no runtime errors. After merging the teammate update, browser checks also confirmed onboarding, Rust recommendation evidence, event-to-community navigation, and the weekly briefing.

The API integration suite starts a temporary local Rust server; allow localhost listeners in your environment. Build the Rust binary and frontend before running it. Coverage includes recognition/matching parity, restrictions, conflicts, cancellations, required/missing/invalid RSVP, completed RSVP, drop-in enrollment, invalid clock input, request validation and static file boundaries. Browser-fallback tests verify that a rejected server request cannot bypass enrollment rules. Workflow checks cover reset/new-chat during pending requests, obsolete errors, changed availability/preferences, duplicate submissions, removal/re-add, independent enrollment and planning, and strict-filter replacement searches.

For this update, browser checks covered Rust planning, incomplete and cancelled RSVP, successful RSVP with immediate calendar updates, cancellation/replacement remaining a suggestion, student-approved drop-in addition, “professional” producing career suggestions, invalid-minute feedback, persistence after reload, and reset. For teammate acceptance, follow the walkthrough above, try those last two prompts, and verify that your added event remains after reloading. Use Settings → Reset demo to restore the original demonstration.

### Documentation convention

With every future push, update this README with the user-visible changes, affected files, setup or API changes, verification performed, and remaining demo limitations so teammates can understand the work without reading chat history. Put longer supporting documentation in `docs/`; GitHub Wiki sources remain in `wiki/`. Commit completed, verified work with a descriptive message.

## Team branches

The shared starting branch is `main`. Individual work branches are `Judy`, `Doris`, `Bella`, and `Tingting` (case-sensitive). Start work on your own branch and open a pull request into `main` for team review.

```sh
git clone git@github.com:judyzhou666/ibm-campus_compass.git
cd ibm-campus_compass
git switch Judy
```

Replace `Judy` with your assigned branch name.

## GitHub Wiki

Wiki page sources live in [`wiki/`](wiki/). After changes merge into `main`, the Publish GitHub Wiki workflow updates the [project Wiki](https://github.com/judyzhou666/ibm-campus_compass/wiki). One-time credential setup and publishing details are in [`docs/github-wiki.md`](docs/github-wiki.md).

</details>
