# Campus Compass

A runnable demonstration for the IBM AI Experiential Learning Lab, based on the supplied Campus Compass proposal and dashboard/planner prototypes.

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

Verification: `npm test` passes the planner assertions, 18 TypeScript tests and 5 Wiki tests; `npm run build` passes. The reviewed Rust code passes its 4 unit tests and API integration suite. Browser checks verify named event-to-community navigation, independent conversation/community joins and leave actions, reload persistence, and a 390px mobile layout without horizontal page overflow. To reproduce the collision regression check, create a local post titled `ai`, join its conversation, and confirm **AI & learning circle** still offers **Join locally**. Join and leave that community; the conversation must remain joined.

## Proposal-aligned MVP improvements — Doris

The Rust planner now returns structured recommendation evidence: interest relevance using the event description, schedule fit including travel buffer, practical requirements, and trade-offs. Chat cards display backend evidence; unavailable-backend suggestions carry an explicit browser simulation notice and do not invent Rust evidence. Evidence describes the recommendation-time snapshot; add actions always check current availability again. Reloaded chat retains event links but does not restore evidence as fresh verification.

Event details now show campus identity, intended audience, eligibility, capacity/availability, food category, source URL, last-checked timestamp and verification status. All 30 records remain fictional. External source URLs and check timestamps are deliberately absent, displayed as Unknown / Not verified. The existing `checked` date records internal authoring review only. Open access in a fictional record does not establish real university eligibility or available seats.

Dashboard **This Week's Briefing** uses deterministic planning for interest and cross-topic suggestions, lists saved-but-not-added events, highlights uncertainty and current plan conflicts/cancellations, and links to details, Planner and Calendar. Cross-disciplinary means topics beyond selected interests; verified department information is unavailable. The digest updates from local state, never background scraping.

First-time demo users can personalize, choose Default Preference, or close the welcome prompt (top-right ×, or Escape) to go straight to the default preferences. Profile supports optional major/interdisciplinary notes, optional research/career goals, academic/social/cultural topic selections and preferred times. Topic selections and preferred time affect ranking; free-text notes are stored locally but are not semantically interpreted. Busy commitments and travel buffer remain editable. A career goal is never required.

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
