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

The fixtures now explicitly author a small participation-format field, including Unknown, for classroom demonstration. This is not inferred beginner suitability, real group size, cross-department eligibility or actual availability. Relevance never establishes permission to attend. Card learning claims refer only to exact confirmed broad topics, never to what a student actually learned in class. “No conflict with the commitments you entered” deliberately avoids claiming verified free time.

## Poster/demo walkthrough

1. Open My Preferences; preview a short reflection and count change, then Cancel. Nothing affects suggestions until Save.
2. Compare two fictional students interested in AI & education: independent/few vs small group/steps. With count 1, the explicit fixture metadata yields creative coding vs the AI lab, plus visibly different next-step guidance.
3. Clear selected interests, retain an unsupported learning note, and manually confirm Career. Enable learning and Save: career suggestions rise. Disable/delete the tag and Save: that connection stops ranking; the raw note alone has no effect.
4. In Planner enter “I’m interested in UX research now.” Choose This search only and inspect unchanged saved preferences. Repeat → Review and save → Cancel, then explicitly confirm. The exact broad topic and conversation provenance become editable in My Preferences.
5. Approve an eligible demo RSVP. Save a narrow available-only window plus free admission, then search Wednesday evening arts. The $12 ceramics fixture cannot be returned as satisfying those constraints. Existing chosen events remain with a review warning; no requirement is relaxed.

No feedback collection system or psychological scoring was added. Future work includes actual student usability/privacy research, organizer-verified metadata and authorized model evaluation, all outside the current deterministic demo.
