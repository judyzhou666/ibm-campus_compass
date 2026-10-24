# My Preferences: implementation and design

The original documentation pass inspected application commit `2dd93ae` on `Doris`. Subsequent draft-entry/navigation repairs and their fresh checks are recorded below; they do not change ranking or API privacy projections. The original proposal attachment is not in this checkout; the supplied requirements and executable source define this implementation. Current fresh checks and deferred verification are separated below.

## Implemented preference flow

The single saved source is `DemoState`. `state.ts` restores it with bounded migration; `preferences.ts` defines version **1**, defaults, mappings and minimal projections. Existing interests, major/raw goals, preferred time, busy blocks and buffer remain canonical. Migration preserves legacy/unrelated data and never promotes free text into confirmed topics or invents consent.

The discoverable **My Preferences** destination is `#profile`. `MyPreferences.tsx` owns one controlled draft, Save, Cancel and an unsaved indicator. `PreferenceSections.tsx` supplies the shared sections. The optional first-time dialog uses this same editor in brief mode for direction/interests, participation and guidance. Skip for now is visible before the questions; Escape works. Skipping preserves saved/sample choices, and unsaved skipping/navigation requires confirmation. Full editing stays available later. There is no second form implementation or preference store.

| Section | Implemented behavior |
|---|---|
| Direction | Multiple structured goals; optional primary belonging to selected goals; existing interests; exclusive Not sure yet; local optional reflection/custom/major/raw-goal notes. Goal choices contribute only after the saved-goal switch is enabled. |
| Learning | Optional recent-learning/next-exploration notes stay separate from topics. Manual supported-topic confirmation prepares a draft and enables learning in that draft; Save applies it. Topics show manual/chat provenance. Removal requires confirmation and then Save; Cancel keeps saved data. |
| Participation/support | Multiple independent/one-to-one/small-group/open choices, or empty exclusive No preference. Guidance is one of few/first/steps/information/none. Result count is 1/3/5, a display limit rather than attendance, workload or a weekly quota. |
| Time/practical needs | Busy commitments and buffer 0/15 minutes; soft preferred time; saved hard free-admission and available-only windows. Location/format notes are not filters. Numeric budgets explicitly abstain. |
| Controls | Separate goal/learning switches stop use without deleting saved entries. Confirmed clear-personalization preserves plans, saved events, RSVP, conversations, memberships and hard scheduling requirements. Clear chat is separate. Not for me/Show another are session-only; legacy saved hidden IDs can be explicitly restored. |

General preference Save preserves latest plans/RSVP/community data and clears obsolete draft/current-search filters. Dashboard/briefing automatically request current suggestions through `useRecommendations`/`requestPlan`. Their keys suppress obsolete responses and expose loading/error/retry states. Planner retains old messages, validated evidence and score snapshots. Changes to relevant structured/time/guidance settings mark earlier suggestions **Based on previous settings** and offer Refresh suggestions without deleting history or plans. Legacy messages without snapshots abstain from reconstructed fit claims.

### Explicit chat proposals

`preferenceProposals.ts` owns a separate **transient pending proposal**, never another saved profile. Positive supported interest statements offer This search only, Review and save, or Dismiss. Review enumerates exact additions, existing topics/provenance and the full topic set that will be enabled, including previously disabled topics. Only its final confirmation updates saved topics. Existing provenance is retained; new tags say Confirmed from a conversation. Confirmation clears obsolete draft suggestions but retains search filters and hard requirements.

One-shot IDs and live revision checks reject dismissed, superseded, stale and deleted proposals, even when settings later revert. Navigation, ordinary new requests, new chat, preference changes and owner disposal invalidate them. Delayed responses cannot restore preferences.

Use once consumes its token, parses time/food/cost/clarification safeguards, then fixes the exact mapped topic set for the current search. It sends a generic Find events request plus validated structured constraints to Rust; intent words cannot overwrite that topic set. It does not update saved topics or interests. Original text enters the existing local conversation only when a search is chosen. Pending text/revision remains transient and is not a profile note.

## Exact ranking and recognition contract

Relevant source: [TypeScript planner](../frontend/src/planner.ts), [Rust planner](../backend/src/planner.rs), [goal/proposal mappings](../frontend/src/preferences.ts), [contracts](../backend/src/model.rs).

Both planners first reject invalid metadata, unsupported RSVP/access, cancellation, already-chosen records, conflicts with entered commitments/actual plans and saved hard requirements. They apply explicit current topic/day/start/end/food/free/exclusion filters and discovery/legacy-hidden exclusions. Ranking cannot override those checks. Saved topic defaults are soft bonuses; a nonempty current topic set is a strict filter replacing them for the topic/diversity components.

For each remaining candidate, add each true component **once**:

| Reason code | Exact condition | Points |
|---|---|---:|
| `topic` | Event topic in nonempty current topics; otherwise in interests ∪ enabled goal topics ∪ enabled confirmed learning topics | 10 |
| `diversity` | Same topic match, and no earlier suggestion in this result has that topic | 4 |
| `learning` | Exact topic in enabled confirmed learning topics | 6 |
| `goal` | Exact topic in enabled mapped goals | 3 |
| `primary` | Exact topic in the enabled primary goal's mapping | 2 |
| `participation` | Event format is known and exactly equals a selected format | 2 |
| `preferred_time` | Morning: end ≤720; afternoon: start ≥720 and end ≤1020; evening: start ≥1020 minutes after local midnight | 2 |
| `free` | Admission cost equals zero | 1 |

| Structured goal ID | Topic mapping |
|---|---|
| `career` | Career |
| `practice`, `research` | AI & education |
| `people` | Social |
| `wellbeing` | Wellbeing |
| `discover`, `unsure`, `other` | Empty: no topic inferred |

The primary uses the selected goal's mapping and adds its bonus alongside the goal bonus. Disabled goal/learning switches project empty arrays; duplicate mappings never multiply bonuses. The frontend maps goal IDs once; Rust validates the projected known topic arrays rather than maintaining an independent drifting goal-ID map. Interests and confirmed topics must be one of AI & education, Career, Social, Arts & culture or Wellbeing. Raw reflection, learning/custom/location notes, major/free-text goals, unconfirmed keywords and guidance add **zero** score.

Participation values are `independent`, `one-to-one`, `small-group`, `open`; event metadata may also be absent or explicitly `unknown`. Unknown gets no bonus, and format/eligibility/suitability is never inferred from titles. Fixture metadata is authored fiction, not verification of actual capacity, group size or beginner suitability.

Greedy selection chooses descending score, then ascending weekday, start minute and ordinal event ID. Diversity uses earlier selections only. Saved count 1/3/5 is the default; a validated current-request limit 1–5 replaces it. Legacy schedules without preferences keep the caller/default limit. The TypeScript evaluation-only `contextual=false` baseline still scores free admission only. Responses expose `matchReasons`: event ID, total and ordered `kind/points/explanation` entries. The browser validates IDs, reason bounds/weights/uniqueness and totals; old responses may omit this optional field. Rust catalog evidence remains separate from fallback reasons.

### Limited proposal recognition

Only positive supported interest/learning/explore-next templates are recognized. The intent prefix is removed before keyword mapping: **“learning about quantum gardening” does not become AI merely because it contains “learning.”** Negated/mixed-negation statements abstain. These are disclosed keyword rules, not arbitrary language understanding:

| Positive statement-body keyword group | Proposed broad topic |
|---|---|
| AI, research, learning, accessibility, educational technology, UX, R, RStudio, data | AI & education |
| Figma, arts, design, culture | Arts & culture |
| career, resume | Career |
| social, friends, community | Social |
| wellbeing, wellness, mindfulness | Wellbeing |

Unsupported statements offer manual topic selection. Numeric budgets remain rejected and ambiguous times still require clarification even for an exact-topic use-once search.

## Discovery versus plan-building

The selection mode is optional `constraints.mode = discovery | plan-building`; root API `mode` remains the separate simulated-provider label. Omission preserves legacy plan-building compatibility.

| Mode | Mutual compatibility among unplanned suggestions | Checks against actual saved commitments/plans and hard constraints |
|---|---|---|
| Discovery | May return overlapping alternatives, including insufficient selected travel time. Cards identify conflicting alternatives and say both cannot fit the schedule. | Required for every candidate |
| Plan-building | Each new suggestion must fit all earlier suggestions, including travel buffer. | Required for every candidate |

Dashboard/briefing explicitly use discovery. Ordinary Planner searches start in discovery; follow-ups and Show another retain active mode. Explicit weekly-plan wording and Build weekly plan select plan-building. Discover alternatives switches back without dropping filters. Reset clears search filters while retaining an explicitly selected mode. Replacements use discovery with the existing one-result limit; refresh retains a historical mode when available. Legacy direct/evaluation callers remain compatible. No caller migration is left pending.

Neither mode adds anything automatically. Latest-schedule validation and explicit demo RSVP still gate Add; after one alternative is chosen, its conflicting partner cannot also be added.

### Saving an actual busy commitment

A new/changed commitment or increased travel buffer may conflict with a chosen event. The editor previews newly introduced conflicts and checks the **latest** plan again in Save. Accessible browser-native confirmation names the affected records and states that events and RSVP will remain. Declining leaves the draft unsaved; accepting stores the commitment without removing, cancelling or replacing anything. Previously acknowledged conflicts do not repeatedly block unrelated saves.

Week tiles, Planner agenda and calendar plan rows show conflicts. Event details and the plan list offer explicit removal; the existing replacement action remains for actual demo cancellations, not a fabricated cancellation caused by busy entry. Future recommendations in both modes exclude busy time. RSVP confirmation revalidates the latest schedule, including commitments saved while RSVP was pending.

## Local storage and transmitted data

Default configuration: fictional-campus, week starting `2026-10-19`, time zone `America/New_York`. Its plaintext `localStorage` key is `campus-compass-demo-v1`; alternate configurations use separate keys containing campus/week/time zone. This is not authenticated multi-campus tenancy or an external calendar connection.

| Data | Stored locally | Sent in current app requests |
|---|---|---|
| Interests; enabled mapped goals/primary/confirmed learning | Yes | Only known structured topic strings |
| Participation, count, preferred time, buffer, free-only/windows | Yes | Required structured settings |
| Busy commitments | Titles and times | Day/start/end only; titles omitted |
| Guidance; learning provenance | Yes | No: presentation/provenance stays local; legacy guidance input is still validated by Rust |
| Reflection/custom/major/raw-goal/learning/next/location/format notes | Yes | Excluded from preference/schedule projection |
| Plan/cancellation/saved/RSVP/history/community data | Yes | Schedule uses plan/cancellation IDs; not saved-event lists, history, memberships or posts. Explicit enrollment sends only its event ID, schedule and required demo RSVP. |
| Demo attendee name | Profile/form state | Only on explicit required demo RSVP submission |
| Current ordinary planner message/prior constraints | Existing local conversation | Can be sent to Rust; copying private text into that message can transmit it |
| Exact-topic use-once proposal | Pending state is transient; chosen search becomes local history | Generic message plus mapped topics/validated constraints, not the raw proposal text |
| Historical settings keys, structured reasons and evidence | Bounded local message snapshots | Not included in schedule requests |
| Not for me / Show another | Current view/conversation memory | Request-only hidden-ID overlay; not a new saved dislike |

See [API projection](../frontend/src/api.ts) and [server validation](../backend/src/model.rs). Optional version-1 preferences contain `goal_topics`, `primary_topics`, `learning_topics`, `participation`, `count`, `free_only`, `windows`, `dismissed`; browser-only guidance is omitted. The service validates known topics, primary-subset consistency, count 1/3/5, participation ≤4, topic arrays ≤5, windows ≤20, blocks ≤100, valid times, known IDs, a 32 KiB request-body limit and a 1–2000-byte message limit. Legacy callers may omit preferences or send bounded busy titles. Current constraints additionally validate mode, day/time, food/free, exclusions and result limit.

Processing is **not entirely on-device**. Available Rust service handles requests; unavailable service uses a labelled TypeScript fallback. No database, new application request/note logging or production privacy infrastructure was added. Transient service memory is not a guarantee about hosting/operator logs or access. Local storage is not encrypted account storage or a server deletion protocol.

Clear-personalization preserves plans, saved events, RSVP, conversations, memberships and hard scheduling requirements. Historical conversation explanations and guided-demo archives can retain earlier structured choices or notes. Clear chat is separate; restoring an archived demo explicitly restores that snapshot. Clearing active preferences does not purge archives or other configuration namespaces. Deliberately clearing all browser storage also discards other saved demo work.

## SDT/BPNT design rationale

Self-Determination Theory is the overarching framework; Basic Psychological Needs Theory is the design lens. These are intended affordances, **not demonstrated psychological outcomes**.

| Lens | Implemented affordance | Claim boundary |
|---|---|---|
| Autonomy | Skip, Cancel, revise, disable, explicit topic consent, optional discovery, every calendar addition approved | No AI authority, mandatory goals, attendance quota, streak or pressure |
| Competence | Manageable counts, selectable guidance depth, source/uncertainty explanations, one clear next step | Asking for guidance does not measure ability or psychological competence |
| Relatedness | Optional interaction formats and existing fictional communities; independent exploration respected | Group size, attendance or a mascot does not establish belonging |
| Personal relevance/internalization discussion | Optional “Why does this matter to you right now?” reflection | Not a validated internalization measure, diagnosis or causal intervention claim |

No psychological scores, personality types or motivation diagnoses are produced. Timetable entries establish entered busy times, not knowledge learned in class. Theory language belongs in developer documentation rather than routine student controls. No student study, feedback-collection system, citations or IBM development-tool usage is invented.

## Implemented versus unfinished

| Area | Status |
|---|---|
| Five-section preferences, shared brief setup, draft/Save/Cancel, bounded migration, consent/provenance and controls | Implemented |
| Deterministic Rust/fallback ranking/reasons, counts, modes, stale-response suppression and history refresh | Implemented; focused parity covers canonical fixtures, not exhaustive equivalence |
| Busy-conflict Save confirmation, preserved plans/RSVP and latest-schedule Add checks | Implemented |
| Local bookmarks/community state and ICS download | Implemented demo features; ICS is a download, not a connected calendar |
| Arbitrary-language understanding, numeric-budget/strict-location filters | Unimplemented; unsupported inputs abstain or remain notes |
| Actual event capacity/eligibility/format verification | Unimplemented; authored fictional metadata with explicit unknowns |
| Live watsonx, real registration, accounts/SSO/database, Canvas and external-calendar integrations | Deferred/outside scope; any future backend adapter must remain Rust |
| Production privacy/authentication, real-student research and measured SDT/BPNT outcomes | Outside this demo and not established |
| Full cross-browser/accessibility certification and exhaustive concurrency/parity proof | Not completed; focused checks do not substitute for them |

Intentional parity boundaries remain: Rust supplies catalog evidence whereas fallback supplies no invented Rust evidence; Rust may use a generic busy label because titles are omitted; browser migration sanitizes malformed local data whereas Rust rejects malformed wire data/fixture enums. The TypeScript evaluation-only baseline has no server endpoint. No canonical selected-ID/score/reason differences appeared in the newly run shared comparisons.

## Short reproducible demo

Use a **separate private browser context**, default fictional configuration and no existing chosen plans. This avoids deleting or altering another stored session. The following demonstrates implemented behavior, not psychological benefit.

1. **Setup and learning.** Skip brief setup or save a few choices, then open full preferences. Clear interests; leave structured goals disabled; set preferred time to **any** and use no extra available-only windows. Type a recent-learning note: it must not create an active topic. Select **Career**, explicitly confirm the tag and Save. With count **1**, Career learning enabled and no other bonuses, the default fixture can suggest `e20`, Networking without the awkwardness. Inspect Added by you provenance. Disable learning and Save to show that the raw note alone has no effect; re-enable for the next step.
2. **Guidance.** Save A clear first step, then A step-by-step plan: inspect the single optional action versus a three-item decision checklist. More information shows known recorded requirements and explicit unknowns. These instructions are not official event requirements. Save/Cancel changes do not add calendar events.
3. **Chat consent.** Enter “I'm interested in UX research now.” Choose This search only and inspect unchanged saved topics. Repeat → Review and save; inspect AI & education as the new broad tag and the full enabled list including Career. Cancel/Dismiss saves nothing. Repeat and explicitly confirm: new provenance is Confirmed from a conversation, existing manual provenance stays. “I'm learning about quantum gardening” offers manual selection rather than inventing understanding.
4. **Overlapping alternatives.** In full preferences choose count **3** and Save, which clears obsolete current filters while keeping conversation history. Ensure no event is yet chosen and no additional busy window blocks Tuesday afternoon. In Planner choose Discover alternatives, then send “events on Tuesday after 3 PM before 5 PM.” `e1`, Learning with AI: a hands-on lab (15:00–16:30, RSVP required), and `e17`, Student wellbeing circle (16:00–17:00, drop-in), overlap. Inspect named alternative warnings. Build weekly plan retains a compatible subset and adds nothing. Switch back to discovery.
5. **Busy-time conflict.** Explicitly add `e1` and complete its demo RSVP. Enter **Actual seminar**, Tuesday **15:00–16:15**, in full preferences. Save warns; decline once and verify the commitment remains unsaved. Save again and confirm. Calendar still contains `e1` and its RSVP, now with conflict markers and an explicit Remove action. No cancellation/replacement occurred. A future Tuesday 15:00–17:00 search excludes the blocked time; a new Add still checks the latest schedule.

## Verification and remaining work

### Earlier documentation-pass checks

During that documentation-only pass, application code was unchanged from `2dd93ae`. The following checks ran then and passed (not fresh repair results):

| Command/check | Result |
|---|---|
| `npm run build` | TypeScript checking and Vite build passed |
| `git diff --check`; local Markdown target validation | Passed; 21 local links exist |
| Focused command below | 60 tests passed, zero failures/skips |
| `cargo fmt --check` | Passed |
| `cargo test --locked` | 13 Rust tests passed |
| `cargo clippy --locked --all-targets -- -D warnings` | Passed |
| `cargo build --locked` | Passed |
| `node --import tsx tests/preference-parity.ts` | 22 exact shared fixture/interpreter/goal comparisons, typed client propagation and six server validation/RSVP/conflict checks passed |

```sh
node --import tsx --test \
  tests/preference-migration.test.ts tests/preferences.test.ts \
  tests/fallback-preferences.test.ts tests/recommendation-modes.test.ts \
  tests/preference-proposals.test.ts tests/busy-commitments.test.ts \
  tests/recommendation-presentation.test.ts tests/api.test.ts
```

In this cloud checkout the successful Rust commands used `CARGO_HOME=/workspace/.cargo`, `RUSTUP_HOME=/workspace/.rustup`, `RUSTUP_TOOLCHAIN=1.99.1`, `/workspace/.cargo/bin` on `PATH`, and `CARGO_BUILD_JOBS=4`. These are environment-specific, not new project requirements.

### Broader verification and remaining checks

No command timed out during the documentation pass. The repair below subsequently ran the full npm/Wiki and broad API suites; frozen evaluation and the full browser matrix remain separate verification work. Exact rerun commands:

```sh
npm test
npm run test:api
npm run evaluate
```

Build frontend/Rust first, start `cargo run --locked` in another terminal, then run browser checks against that current process. With optional Playwright installed externally and Chromium available (see [backend setup](backend.md#optional-browser-regression)):

```sh
export PLAYWRIGHT_MODULE=/workspace/campus-browser/node_modules/playwright/index.mjs
export CHROMIUM_PATH=/usr/bin/chromium
export CAMPUS_TEST_URL=http://127.0.0.1:4173
node scripts/browser-brief-setup.mjs
node scripts/browser-preference-proposals.mjs
node scripts/browser-recommendation-modes.mjs
node scripts/browser-busy-commitments.mjs
node scripts/browser-preference-surfaces.mjs
node scripts/browser-journey.mjs
```

Adjust optional-tool paths/URL to the actual environment; Playwright is not an application dependency. That complete browser matrix was **not rerun during the documentation pass or subsequent repair**; the repair ran the specific draft-entry and busy-conflict journeys listed below. Nor were live watsonx, real enrollment, external integrations, production privacy, a full accessibility audit, alternate browsers or real-student outcomes tested. Functional implementation requested for this preference iteration is present; remaining verification and deferred production capabilities above remain separate work.

### Draft-entry and navigation repair verification

Unadded commitment/window fields now participate in dirty tracking and unload/navigation warnings. Their baselines advance only after Add. Save refuses unfinished entries, announces the error and focuses the entry; Clear entry or confirmed Cancel resets the controls. No busy time is silently saved or discarded. Ordinary brand-link navigation prevents its anchor default and uses the guarded route once, preserving modified-click browser behavior. The API regression expectation includes `mode:discovery`.

Freshly run for this repair: `npm run build`; `npm test` (117 TypeScript tests, 5 Wiki tests and planner assertions); `npm run test:api`; `scripts/browser-preference-drafts.mjs` at 1280/390px; and `scripts/browser-busy-commitments.mjs` desktop online/mobile fallback. All passed. Draft regressions cover blocked partial Save, focus, one declined brand prompt, preserved fields, clearing/Cancel and successful added-entry Save. Busy regressions retain actual demo RSVP approval, conflict confirmation, preserved plan/RSVP and future blocked-time checks. Rust unit/Clippy and frozen evaluation were not newly run in this repair.
