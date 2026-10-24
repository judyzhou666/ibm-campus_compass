# Campus Compass

A classroom demo with a React/TypeScript frontend, Rust backend, explicitly labelled browser fallback, and fictional events for **October 19–23, 2026, America/New_York**. No real seat is reserved and no live watsonx connection is implemented.

## Doris branch integration

Integrated the remote clarification-context fix while preserving the preference features and draft-entry repairs. Fresh merge verification passed: frontend build/type checking, planner assertions, 127 TypeScript tests, 5 Wiki tests, and Rust API integration. No new browser journey or Rust unit/Clippy run was performed for this merge. Run with the existing build/start instructions below; multi-part clarification must retain every unresolved requirement before returning suggestions. Existing fictional-demo and integration limitations remain unchanged.

## Draft-entry and navigation repairs

Unadded busy commitments and availability windows now count as unsaved edits. Save rejects incomplete entries with an accessible message and focuses the relevant field; Add stages an entry, Clear entry discards it, and Cancel resets both staged controls and the preference draft. Navigation warns before losing typed entries. The brand link prevents duplicate default navigation, so declining produces one discard prompt; modified clicks retain normal browser link behavior. The API integration expectation now includes the intentional discovery mode.

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

`constraints.mode` is `discovery` or `plan-building`. Omission preserves legacy plan-building. Dashboard/briefing and ordinary Planner discovery explicitly use discovery; **Build weekly plan** or explicit weekly-plan wording selects plan-building. Mode switches retain current filters.

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

Rust selection now uses its structured scoring explanation function and returns the same ordered `matchReasons` as TypeScript: topic/diversity, enabled mapped goals/primary/confirmed learning, known participation, preferred time and free admission. Current-topic/limit behavior and hard constraints are preserved. The typed client validates reason codes, exact weights, totals and bounded collections, while accepting older responses without reasons. Goal IDs are projected once to validated topic arrays before requests; no title/note inference or duplicate mapping is introduced.

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

See [backend architecture and test commands](docs/backend.md) and [IBM Bob setup](docs/ibm-bob-setup.md).

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
8. Close by stating the limitations: fictional data, simulated chat, no external calendar connections, watsonx to be integrated later.

## Current boundaries

This version uses a Rust deterministic parser and template responses, with a labelled TypeScript fallback when the backend is unavailable. It is not a general-purpose language model or a live IBM-powered chatbot. Ambiguous natural language and unsupported constraints may not be understood; use the example prompts for the demo. “Start over” clears prior chat filters. It does not create real RSVPs, send messages, or sync calendars. Local discussion posts are not shared. Data is fixed, not live or fetched daily. The institution and business outcomes in the proposal remain hypotheses.

IBM Bob is a development assistant. This implementation was created in Codex and is not evidence of IBM Bob use. Your team should perform and document genuine Bob-assisted development/testing before describing the course's Bob component as fulfilled. The user has IBM watsonx access and chose to integrate it later.

## Files and extension point

- `backend/src/`: Rust Axum API, simulated interpreter, schedule validation and event matching.
- `frontend/src/`: React/TypeScript UI, typed API calls, local persistence, calendar export and explicit browser simulation fallback.
- `data/events.json`: shared catalog of 30 fictional events.
- `frontend/public/assets/mascot.png`: unchanged supplied mascot.
- `dist/`: generated build output, ignored by Git.
- `tests/` and `test.mjs`: API, fallback, scheduling and Wiki publisher checks.
- `WATSONX-NEXT-STEPS.md`: future Rust integration checklist.

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
