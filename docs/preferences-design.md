# My Preferences: design and implementation

## Meeting-derived problem and scope

The October 23 discussion described fragmented event information, limited cross-department discovery, uncertainty about relevance to learning, and the distinction between a timetable and learning itself. The implemented path is **My Preferences → understandable recommendations → student-approved planning → editable preferences**. It extends the existing browser-local state and Rust planner; it is not a second profile or separate prototype. The original proposal document is not present in this workspace; scope follows the supplied implementation request and repository documentation. No student findings, citations, measured psychological outcomes or IBM usage are invented.

Event publishing/organizer roles, moderation, institutional SSO, Canvas, real calendars, production privacy infrastructure and live watsonx remain outside this iteration. No Python backend, database or research collection service was added.

## Flow and controls

My Preferences replaces the old Profile editing form at the existing `#profile` route and is named in navigation. A small first-time dialog offers topic/direction, participation and guidance choices, a quick save, expansion into the full editor, sample preferences, or general browsing. Nothing requires a career goal. The editor has five sections, a live unsaved summary, Save changes and Cancel. Unsaved edits do not change recommendations. Save updates only editable fields on the latest state, preserving calendar, RSVP, posts, communities and saved events; it clears obsolete draft/current-search filters. Navigation discards an unsaved draft. Existing note and preference fields are reused rather than duplicated.

- **Direction:** multiple structured goals, optional primary goal, existing interests and optional local custom/relevance notes. Not sure yet is exclusive; a primary goal must belong to selected goals.
- **Learning:** optional current/next notes remain notes. A small disclosed keyword dictionary can suggest existing broad demo topics (e.g. R/research/accessibility → AI & education, Figma/design → Arts & culture). It is not semantic understanding. Students explicitly confirm a supported tag; unsupported/custom notes remain intact with manual topic selection. Confirmation in the editor previews an enabled learning choice; Save is still required before processing changes. Each tag has Added by you or Confirmed from a conversation provenance and can be removed.
- **Participation/support:** independent, one-to-one, small group, open events or an empty No preference choice. Guidance changes instructions and evidence depth: short choices/first action vs expanded evidence and steps or information to confirm. Counts 1/3/5 limit suggestions, not attendance. There is no weekly workload or attendance cap.
- **Practical:** busy commitments and travel buffer are hard checks. Preferred time is a ranking bonus. Optional available-only windows and free admission are hard requirements; a current chat cannot relax them. Numeric budgets still explicitly abstain. Location/format notes are local-only, unsupported as filters. Explicit fictional participation metadata may rank events; unknown format is not inferred from a title.
- **Controls:** goals and learning can independently be enabled/disabled. Clear personalization requires confirmation and removes local personal notes/topics/choices, but preserves plans, RSVP, communities, busy times and saved hard requirements. Clear local planner conversation is separate. Not for me explicitly hides an event from future local suggestions, reversible here. Show another skips an event for the current conversation or dashboard session; it does not silently save a dislike.

An explicit Explore beyond my interests search excludes saved active topics while retaining all hard checks. A newly stated topic replaces this soft discovery mode for that search. Preference changes refresh Dashboard/briefing/planner suggestions and invalidate stale requests without removing chosen events. Calendar/briefing flag choices that no longer fit; removals remain student actions.

## SDT/BPNT design lens

| Lens | Implemented design choice | What is not inferred or claimed |
|---|---|---|
| Autonomy | Skip, cancel, revise, disable, remove, save deliberately, opt into discovery, review exact chat proposals, confirm every calendar addition | No AI authority, automatic enrollment, attendance quota, streak or pressure |
| Competence | Clear next steps, optional guidance depth, small result counts, source/uncertainty explanations and manageable actions | Asking for steps does not measure ability or psychological competence |
| Relatedness | Explicit interaction-format choices and existing topic-related fictional communities, while supporting independent exploration | Attendance, group size and cat interaction do not measure belonging |
| Optional personal relevance | “Why does this matter to you right now?” supports reflection and stays local | It is not an internalization measure and no causal motivation outcome is claimed |

These are theory-informed design rationales, not validated scales or proven outcomes. Theory labels appear here, not in ordinary student controls. The cat remains a small guide; preferences are editable without interacting with it.

## State, migration, privacy and consent

`DemoState` remains the one saved source of truth. Existing `interests`, `preferred_time`, `major`, `goals`, `blocks` and `buffer` stay canonical; the version-1 `preferences` object holds new structured choices, optional local notes, switches, confirmed-topic provenance and dismissed IDs. A bounded migration supplies safe defaults, preserves legacy notes/plan/RSVP/messages/community state, and never converts free text into confirmed topics or invents enabled-goal/learning consent. Legacy sample interests are preserved. Unknown enum/tag values are discarded on local migration and rejected server-side in requests.

| Information | Browser storage | Sent to Rust |
|---|---|---|
| Interests, enabled mapped goals and learning tags | Yes | Only required structured topic values |
| Primary-goal ranking, participation, guidance, count | Yes | Bounded structured settings (schema version 1), except guidance stays local for presentation |
| Busy commitments, buffer, preferred time, free-only/windows | Yes | Only conflict/ranking fields; busy commitment titles are omitted |
| Reflection, custom interest, major, raw goal, learning/next and location/format notes | Yes, plaintext in browser-local demo state | No |
| Demo display name | Local profile | Only when the student explicitly submits a required demo RSVP |
| Learning provenance | Yes | Topic strings only; provenance is a local UI record |
| Current voluntary planner request | Existing local message history | Current message/prior structured constraints when needed for that search; supported preference proposals use explicit broad-topic mapping |
| Plan, cancellation and RSVP data | Existing local state | Only the existing fields required to check a plan/enrollment; never chat history or posts |

`wirePreferences` projects an allowlisted shape. Serde rejects unknown preference fields, unknown enums/topics, invalid version/count/windows and unrecognized dismissed IDs. It does not accept raw personal notes. Requests are processed by the Rust service when available, or by a visibly labelled TypeScript simulation. There is no application database or new request/note logging. Requests exist transiently in service memory; infrastructure logs/administrator access are not a production privacy guarantee. Browser storage is not encryption, institutional approval or an access-control system. Clearing chat/personalization is a local UI operation, not a server deletion protocol. The existing guided-demo launcher may archive a pre-demo local snapshot; active personalization clearing does not purge that archive or other configuration namespaces. Restore previous demo is an explicit action that restores its earlier preferences. Clear browser storage deliberately if those local snapshots must be removed; that also discards other saved demo data.

Preference proposals are transient UI state, separate from confirmed topics. A supported conversational interest such as UX research offers This search only, Review and save, or Dismiss. Review shows the exact broad tags, provenance and enablement; only Confirm and save changes long-term settings. Unsupported input offers manual selection. Navigation, new chat or saved-preference revisions discard pending proposals. Saving preferences clears current search filters; old message snapshots never repopulate deleted preferences. Local planning keys include saved preference revisions to reject stale results. Enrollment independently rechecks the latest hard constraints after asynchronous confirmation.

## Deterministic matching contract

Both Rust and the labelled fallback use the same order: validate event/access/cancellation → saved hard requirements and entered conflicts → explicit request topic/day/time/food/free/exclusions → ranking → pairwise buffer-compatible selection → guidance and count. Saved hard constraints also apply to manual additions. Dismissed events are excluded from suggestions but can still be intentionally added from Explore after validation.

Ranking score: matching current/active topic **10**, an unrepresented matching topic **4**, confirmed enabled learning connection **6**, enabled structured goal topic **3**, primary-goal topic **2**, matching explicit fictional participation format **2**, preferred time **2**, free admission **1**. Stable ties use weekday, start time and event ID. Current topics restrict the candidate set; saved defaults cannot widen it. Goal mapping: career → Career; practice/research → AI & education; people → Social; wellbeing → Wellbeing; discovery/not sure/other → no inferred topic. Unknown participation formats receive no matching bonus.

### Shared TypeScript and Rust scoring details

`frontend/src/planner.ts` exports `RANKING_WEIGHTS`, `rankingDetails` and `recommendWithReasons`. The shared fallback request path returns local `matchReasons` (event ID, total score, and ordered `kind/points/explanation` entries); Rust evidence remains separate and is never fabricated. Reasons are recomputed per greedy selection using only already-selected events for diversity. Ranking details alone do not prove eligibility: filtering and pairwise travel checks run before selection.

| Reason code | Exact condition | Points |
|---|---|---:|
| topic | Event topic in nonempty current topics, otherwise union of interests + enabled goal/learning topics | 10 |
| diversity | Same topic match and no earlier suggestion has that topic | 4 |
| learning | Exact event-topic match in enabled confirmed learning topics | 6 |
| goal | Exact event-topic match in enabled mapped structured goals | 3 |
| primary | Exact event-topic match in enabled selected primary goal mapping | 2 |
| participation | Event format is known and exactly equals a selected format | 2 |
| preferred_time | Morning: end ≤720; afternoon: start ≥720 and end ≤1020; evening: start ≥1020 | 2 |
| free | Event admission cost is zero | 1 |

All true conditions add once, including both goal and primary bonuses. Duplicate goals/tags never multiply a bonus. Goal IDs map as follows: `career→Career`, `practice/research→AI & education`, `people→Social`, `wellbeing→Wellbeing`; `discover/unsure/other→[]`. Goals and learning topics contribute only when their respective saved switch is enabled. Raw notes, major, unconfirmed learning and guidance add zero points; unknown/missing event participation adds zero. No metadata is inferred from titles.

At every selection step, choose descending total score, then ascending numeric weekday, start minute, and ordinal event ID (no locale-dependent collation). Enforce pairwise travel-buffer compatibility with earlier suggestions before scoring. The selected saved count (1/3/5) is the default; a validated current-request limit (1–5) replaces it for that request. Old schedules without preferences retain the existing caller/default limit. The evaluation-only `contextual=false` baseline continues to score free admission only.

Current topics are a strict candidate filter and replace saved topic defaults for the base/diversity components; enabled secondary goal/learning/participation/time bonuses remain available among eligible candidates. Current topics cannot bypass saved free-only/windows, busy blocks, travel buffer, cancelled/chosen records, eligibility, RSVP metadata, or explicit day/start/end/food/free/exclusion filters. Numeric budgets remain explicitly unsupported; the existing free-admission hard constraint is preserved.

Rust now exports the same weight table and `ranking_details`, uses that function for greedy selection, and emits per-selected-event `matchReasons` through `/api/plan`. Ordered reason codes, points, totals and explanation text match `recommendWithReasons` exactly on the shared fixtures. The browser validates returned IDs, reason codes/weights, bounded reason counts, uniqueness and score sums; responses from older services may omit this optional field.

Goal IDs are mapped once by the existing frontend allowlist before the request: only enabled `goal_topics/primary_topics/learning_topics` reach Rust. Rust independently validates those topic arrays and their bounds; it never infers goals from titles, notes or timetable labels. Disabled goals/learning remain local and project to empty arrays. The shared comparison exercises every goal ID through this real projection rather than maintaining a second drifting mapping.

Parity verification: `node --import tsx tests/preference-parity.ts` starts the built Rust binary on an ephemeral localhost port and compares 10 fixtures from `tests/fixtures/preference-parity.json` plus all 8 goal mappings. It compares selected IDs and the complete score/reason structures, then checks client propagation and 6 validation/RSVP/conflict outcomes. Run `cargo build --locked` first. Synthetic inputs only; no live integration is used.

Remaining intentional differences: Rust produces its existing catalog evidence, while fallback returns no invented Rust evidence and shows an offline notice. Conflict diagnostics may use generic busy-block labels on Rust because local titles are omitted from requests. Browser migration normalizes malformed local data; Rust strictly rejects malformed wire inputs and invalid fixture enum values (the browser fixture loader normalizes unsupported formats to Unknown). The TypeScript evaluation-only `contextual=false` baseline has no service endpoint. No selected-ID, score, reason, count or hard-filter differences were observed for the compared canonical inputs; this is a focused comparison rather than exhaustive equivalence proof.

The fixtures now explicitly author a small participation-format field, including Unknown, for classroom demonstration. This is not inferred beginner suitability, real group size, cross-department eligibility or actual availability. Relevance never establishes permission to attend. Card learning claims refer only to exact confirmed broad topics, never to what a student actually learned in class. “No conflict with the commitments you entered” deliberately avoids claiming verified free time.

## Poster/demo walkthrough

1. Open My Preferences; preview a short reflection and count change, then Cancel. Nothing affects suggestions until Save.
2. Compare two fictional students interested in AI & education: independent/few vs small group/steps. With count 1, the explicit fixture metadata yields creative coding vs the AI lab, plus visibly different next-step guidance.
3. Clear selected interests, retain an unsupported learning note, and manually confirm Career. Enable learning and Save: career suggestions rise. Disable/delete the tag and Save: that connection stops ranking; the raw note alone has no effect.
4. In Planner enter “I’m interested in UX research now.” Choose This search only and inspect unchanged saved preferences. Repeat → Review and save → Cancel, then explicitly confirm. The exact broad topic and conversation provenance become editable in My Preferences.
5. Approve an eligible demo RSVP. Save a narrow available-only window plus free admission, then search Wednesday evening arts. The $12 ceramics fixture cannot be returned as satisfying those constraints. Existing chosen events remain with a review warning; no requirement is relaxed.

No feedback collection system or psychological scoring was added. Future work includes actual student usability/privacy research, organizer-verified metadata and authorized model evaluation, all outside the current deterministic demo.

## Connected recommendation surfaces and historical messages

Dashboard and both briefing queries use `useRecommendations` over `requestPlan`; Planner uses the same request path. A compact “Using your preferences” summary links to the single editor. Saving changes the request key and replaces current Dashboard/briefing results only after current-key responses arrive. Cleanup plus key checks suppress obsolete responses, including delayed five-result responses after a new one-result save.

`RecommendationPresentation.tsx` renders grounded structured reasons and guidance consistently in cards, briefing lists, chat and the draft sidebar. Few/none stay concise; first shows one optional action; steps is a three-item decision checklist; information shows known catalog requirements and explicit unknowns. Optional preparation/decision guidance is labelled separately from recorded requirements. All records remain fictional; no official registration steps or unknown event facts are inferred.

New recommendation messages persist a local `settingsKey`, structured match reasons and validated bounded catalog evidence. The key contains only normalized structured settings and conflict times, never reflection/learning notes or busy labels. Historical keys are not request payloads. Changing relevant saved settings marks earlier suggestions “Based on previous settings” and offers “Refresh suggestions”; refresh appends current suggestions without deleting messages, plans or RSVP records. Current Add/RSVP validation still applies to historical cards. Legacy messages without snapshots are marked previous/unknown and never receive reconstructed current-fit claims. Migration retains bounded historical evidence and drops malformed snapshots. Clearing active personalization preserves this conversation history; clear chat remains separate.

Verification: frontend build/type checking, 78 focused API/preference/workflow/presentation tests, desktop-online/mobile-offline surface checks, the existing preference journeys and the full desktop/mobile guided journeys passed. `scripts/browser-preference-surfaces.mjs` also holds an obsolete response to verify it cannot restore prior results. No Rust ranking or enrollment rules changed in this UI/state task.

## Selection modes

Optional `constraints.mode` separates discovery from plan-building. No mode preserves legacy plan-building. Discovery treats each suggestion as an independently feasible alternative and may return mutually overlapping unplanned events; plan-building additionally checks pairwise scheduling/travel-buffer compatibility during greedy selection. Neither mode bypasses existing commitments, chosen plan entries, eligibility, saved windows/free-only or explicit request filters. The score/reason/count contract remains identical.

Callers choose discovery for Dashboard, briefing, ordinary new Planner searches and one-result cancellation alternatives; explicit weekly-plan requests/actions use plan-building. Follow-ups preserve active filters/mode, refresh uses the historical mode when supplied, and legacy direct callers remain compatible. Cards show known conflicting alternative titles and distinguish overlap/insufficient travel time from feasibility against existing commitments. Adding one event still revalidates the latest schedule and RSVP before any change; other alternatives then show a current conflict.

## One-shot pending preference proposals

`preferenceProposals.ts` owns a separate transient pending store with monotonically changing tokens. Proposing, reviewing, using once or dismissing does not write saved preferences. Only `confirm(id)` adds the listed topics/enables learning; existing topic provenance is preserved. The review lists exact new topics, already-confirmed topics, and the complete topic set that becomes enabled (including previously disabled saved topics). Confirmation clears obsolete draft suggestions while preserving current search filters, saved hard requirements, plans, RSVP and conversation state.

Recognition is limited to positive interest/learning/explore-next phrase templates followed by known keywords. Intent-prefix words do not become topic evidence: “learning about quantum gardening” abstains instead of mapping “learning” to AI. Negated/mixed-negation statements abstain and offer manual topic selection. The interface discloses deterministic keyword mapping and makes no arbitrary-language-understanding claim.

Use once consumes its pending token and applies only supported topics to the current search, retaining explicit day/time/food/free/mode constraints and all saved hard requirements. Dismissed/superseded tokens never become current again. A synchronous saved-preference observer consumes pending tokens on changes, even if settings later revert to their earlier value. Navigation, ordinary new requests, new chat and owner disposal also discard proposals. Both use-once and confirmation check live store state, not render-time values. Obsolete planning responses remain unable to restore deleted preferences. Pending text/revision stay transient. Use once records the entered message in the existing local conversation, validates its filters/clarifications, and sends the exact mapped topics plus validated structured constraints to the planner with a generic request. The revision is never sent; raw intent words cannot replace the reviewed topic set. Confirmation saves only structured topics/provenance/enablement.

Verification: frontend build/type checking, 31 focused proposal/API/history tests and desktop-online/mobile-offline proposal journeys passed. Browser coverage includes exact review, use-once filter preservation, Cancel/Dismiss, unsupported manual selection, ordinary-request supersession, provenance-preserving confirmation, navigation and deletion. Run `scripts/browser-preference-proposals.mjs` with the optional Playwright environment in `docs/backend.md`.

## Busy commitments versus preserved plans

An actual entered commitment may overlap a chosen fictional event. The editor previews new conflicts (including a newly increased travel buffer) and checks again against the latest plan in the Save callback. A keyboard/screen-reader accessible browser-native confirmation names affected events and commitments and explicitly says the plan and RSVP remain. Refusal leaves the draft unsaved; acceptance saves the busy times without changing plan/RSVP/cancellation records. Already acknowledged conflicts do not repeatedly block unrelated saves.

Existing week tiles, Planner agenda and calendar plan rows display current conflicts. Calendar rows/details offer explicit removal; the existing cancellation-replacement flow remains reserved for cancelled events. Busy entry never fabricates a cancellation or invokes replacement/removal. Both planners already treat entered commitments as hard exclusions, and the existing latest-state enrollment/RSVP recheck remains authoritative. Raw busy titles are not added to request payloads.

Focused checks: 59 tests covering busy conflicts, preferences and workflows; frontend build/type checking; desktop online/mobile offline browser journeys through actual RSVP, warning decline/accept, conflict marking, preserved records/reload and future blocked-time recommendations. Browser regression: `scripts/browser-busy-commitments.mjs`. No backend or integration changes were needed.
