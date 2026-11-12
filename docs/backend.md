# Rust backend and React frontend

Campus Compass is a classroom demo with fictional events and browser-local preferences. The backend is Rust (Axum, Tokio, Serde); the frontend is React + TypeScript compiled to JavaScript with Vite. Python is not required by the application, tests, or development commands.

## Run

Install a stable Rust toolchain and Node.js 22.12 or newer. From the repository root:

```sh
npm ci
npm run build
cargo run --locked
```

Open http://127.0.0.1:4173. Rust serves both the compiled frontend and the API. `dist/` is generated and ignored; rebuild after frontend changes. Rust embeds `data/events.json` at compile time, so rebuild both sides after catalog changes. Keep `dist/` beside the source checkout when running the local demo binary; it resolves that directory from the build-time project location.

For frontend development, leave Rust running and run `npm run dev` in another terminal. Vite serves the frontend at its printed URL and proxies `/api` to port 4173. If you change the Rust address, update the Vite proxy too.

`CAMPUS_ADDR` defaults to `127.0.0.1:4173`. `PLANNER_PROVIDER` defaults to `simulated`, which needs no credentials. `PLANNER_PROVIDER=watsonx` enables the live IBM interpreter described below; any other value stops startup with an explicit error.

## Source layout

- `backend/src/main.rs`: listener, local address, provider selection, graceful shutdown.
- `backend/src/lib.rs`: API routes, JSON input boundaries, static serving.
- `backend/src/interpreter.rs`: fallible asynchronous `Interpreter` trait, `InterpretError`, and the Rust simulated parser.
- `backend/src/watsonx.rs`: live IBM watsonx.ai interpreter and its mock-server tests.
- `backend/src/planner.rs`: trusted event selection, access checks, conflicts and travel buffers.
- `backend/src/model.rs`: typed request models and validation.
- `frontend/src/`: React components, TypeScript API client, local state, calendar export and browser simulation fallback.
- `frontend/src/enrollment.ts`: demo enrollment approval, pending-request invalidation, latest-schedule checks, and calendar/RSVP updates.
- `frontend/src/conversation.ts`: planning conversation lifecycle, stale-result rejection, and cancellation replacement coordination.
- `frontend/src/interpretation.ts`: TypeScript request recognition, parsing and constraint validation, aligned with the Rust interpreter.
- `frontend/public/assets/mascot.png`: unchanged supplied mascot.
- `data/events.json`: single shared fictional event catalog.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Reports the configured `mode` and `provider`, `watsonx_configured`, and `watsonx_connected` (true only after the latest live call succeeded). |
| `POST /api/plan` | Accepts `message`, `previous` constraints and `state`; returns validated constraints, `understood`, an optional `clarification`, trusted `event_ids`, canonical `match_reasons`, `recommendations` evidence, a no-match `diagnostic`, the `mode` (`simulated` or `watsonx`) and `provider` that actually answered, and an optional watsonx fallback `notice`. |
| `POST /api/validate` | Accepts `event_id` and latest schedule `state`; returns `allowed` and `issue`. |
| `POST /api/enroll` | Accepts `event_id`, latest `state`, and optional `rsvp`; checks access/conflicts and mandatory RSVP, then returns a simulated enrollment confirmation. |

Schedule state contains `plan`, `cancelled`, `interests`, `blocks` and `buffer`. New busy-block payloads contain only day (Monday = 0) and start/end minutes after midnight. Local titles are omitted. Legacy callers may still provide a bounded title; absent labels use “Busy commitment” in server diagnostics. Planning and validation requests omit display names, discussion posts and chat history. Enrollment sends only the RSVP form’s demo display name and attendance confirmation alongside the schedule snapshot. Only known event IDs and topics are accepted. JSON bodies are capped at 32 KiB; messages at 2,000 bytes. Travel buffers are 0 or 15 minutes.

The frontend rechecks the current schedule before accepting asynchronous results. Reset invalidates pending planning and enrollment requests; new-chat invalidates planning requests. Additions always require a student action and are checked again against current state. Backend requests do not create real RSVPs or persist a shared calendar.

Request recognition belongs to interpretation, including synonyms such as “professional”, “ceramics”, “balance”, “snack” and “refreshment”, plus generic requests such as “options”. An unsupported request returns `understood: false` with no event IDs; the browser shows explicit guidance. A recognized request with no eligible matches returns `understood: true` and an empty list. Both interpreters reject invalid clock input, including invalid minutes and out-of-range AM/PM hours. The browser validates messages and constraints before choosing Rust or fallback, and validates constraints received from Rust. Rebuild both sides together for the added recognition field.

The browser's demo state is an observable store. Enrollment and conversation modules own their pending work and expose read-only status to React through `useSyncExternalStore`; views handle form rendering and navigation. Reset and unmount discard obsolete successes and failures without changing a newer request's busy status. Replacement preserves strict filters and checks validity before accepting a suggestion. Calendar removal goes through enrollment so RSVP state is cleared consistently. Workflow tests cross these same module interfaces with controlled fetch completion, rather than testing private tokens or refs.

Rust handles chat and replacement matching. TypeScript retains the same rules for instant event-card feedback and a portable static-demo fallback; integration tests compare the two implementations. An unavailable backend triggers an explicit fallback notice. Rejected input is shown as an error, not silently retried through the local planner.

## Demo RSVP and calendar state

For an event whose catalog `rsvp` value is `RSVP required`, enrollment requires `rsvp: { "display_name": "Demo student", "attending": true }`. The Rust endpoint rejects missing approval, blank names and names longer than 120 UTF-8 bytes with HTTP 422. Unknown events or invalid schedules fail validation; cancelled, restricted, full or conflicting events return HTTP 409. Eligible drop-in events need no RSVP object. Success returns `{ "event_id": "e1", "demo": true, "status": "enrolled", "rsvp_confirmed": true }` (the final flag is false for drop-in events).

This endpoint does not persist registrations or send messages. The browser adds an event to its shared plan only after confirmation and a second check against its latest schedule. Confirmed RSVP IDs persist locally with the calendar. Removing the event clears that confirmation; adding it again requires a fresh RSVP. Existing pre-update calendar entries are retained for compatibility. Chat cards store known event IDs, so details and availability are resolved from the current catalog and schedule.

Closing the form before submission changes nothing. Submitting locks enrollment controls until the request completes. If the backend is unavailable, the same mandatory fields and schedule rules are enforced locally and a visible notice identifies the local demo. Input/authorization/conflict rejections are surfaced instead of falling back. This is intentionally a single-browser simulation, not a secure enrollment or capacity management system.

## IBM watsonx interpreter

`backend/src/watsonx.rs` implements `Interpreter` against IBM watsonx.ai. Enable it with server-side environment variables (template: `.env.example`; the server does not load `.env` itself):

| Variable | Required | Default |
| --- | --- | --- |
| `PLANNER_PROVIDER` | yes, `watsonx` | `simulated` |
| `WATSONX_API_KEY` | yes | — (IBM Cloud API key) |
| `WATSONX_PROJECT_ID` | yes | — (watsonx.ai project) |
| `WATSONX_URL` | no | `https://us-south.ml.cloud.ibm.com` |
| `WATSONX_MODEL_ID` | no | `ibm/granite-4-h-small` |
| `WATSONX_API_VERSION` | no | `2024-03-14` |
| `WATSONX_IAM_URL` | no | `https://iam.cloud.ibm.com/identity/token` |

Request flow for each `/api/plan` call:

1. Exchange the API key for an IAM bearer token (`grant_type=urn:ibm:params:oauth:grant-type:apikey`), cached until a minute before expiry and cleared after a 401/403 from watsonx.
2. `POST {WATSONX_URL}/ml/v1/text/chat?version=…` with `model_id`, `project_id`, a system prompt listing the allowed constraint keys and topics, and a user message `{"previous": <constraints>, "message": <text>}` in which days are written as English weekday names. Parameters: `temperature: 0`, `max_tokens: 300`, `response_format: {"type":"json_object"}`, `time_limit`. Schedule, profile, names and chat history are not sent.
3. Read `choices[0].message.content`, strip an optional Markdown code fence, require a JSON object, convert weekday names (case-insensitive) to Monday = 0 … Sunday = 6, deserialize into `Constraints` (`deny_unknown_fields`) and run `Constraints::validate`. The handler validates again before deterministic matching.
4. The whole call is bounded at 6 s, below the browser's 8 s request timeout.

Any failure (timeout, network, IAM or chat authentication, other HTTP status, malformed or invalid output) is logged as its kind only. That request is then answered by `SimulatedInterpreter` with `mode: "simulated"`, `provider: "rust-rules"` and `notice: "IBM watsonx was unavailable, so this answer used the simulated demo planner."`. The frontend shows the notice and labels the reply by the mode that answered. Logs, responses and `Debug` output never contain the API key, token, student message or upstream bodies.

Deterministic clarifications (such as an unsupported numeric budget) are decided by the simulated rules before any model call. The browser still refuses messages its local rules do not recognise before sending a request. Direct API clients may send such messages to watsonx when deterministic safety rules do not require clarification; in simulated mode the server answers `understood: false`. A watsonx answer is always treated as understood.

Rust tests in `watsonx.rs` and `lib.rs` use a local mock IAM and watsonx.ai server, so no IBM credentials are needed to run them. The first live run against the team sandbox is recorded in README.md; see `WATSONX-NEXT-STEPS.md` for the full live acceptance checklist.

PostgreSQL/SQLx and authentication are future production work, not demo dependencies. If introduced, the backend must own authorization and persisted state rather than trusting the browser's schedule snapshot. The current server binds to localhost by default; it is not a production multi-user service.

## Verify

```sh
npm test
npm run build
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo build --locked
npm run test:api
```

The API integration test starts a temporary local Rust server and checks rule parity, follow-ups, access restrictions, cancellations, malformed requests, size limits and static file boundaries. The browser UI should also be exercised for chat → add → cancellation → replacement → calendar export, profile editing, local discussion, reset, and mobile navigation.

## Doris MVP additions

`POST /api/plan` preserves `mode`, `provider`, `constraints` and `event_ids`, and adds `recommendations`: one object per selected ID with `event_id`, `interest_match`, `schedule_fit`, `practical`, and `trade_offs`. Rust derives these strings from embedded synthetic catalog facts and validated constraints. Evidence is a planning-time snapshot, not a booking or external verification. Eligible selections still pass deterministic access, cancellation, conflicts, buffer and pairwise-overlap checks.

Schedule payloads accept optional `preferred_time`: `any` (or omitted/empty), `morning`, `afternoon`, `evening`. Unknown values return HTTP 400. Preferences add a ranking bonus; explicit chat constraints remain strict. TypeScript fallback uses matching ranking but supplies no invented Rust evidence. Existing clients can omit the new preference and ignore the additive response field.

Catalog additions are `campus_id`, nullable `source_url` and `last_checked_at`, `intended_audience`, `eligibility`, `availability`, `verification_status`, and `food_status`. Food categories distinguish Full meal, Refreshments, Paid food, None and Unknown without changing existing `food` matching values. Missing external URLs/check timestamps stay null. `checked` remains an internal authoring date. Full capacity remains excluded; unknown real capacity is explicitly disclosed for fictional open demo records.

Browser state keeps the existing storage key with safe defaults for `onboarded`, `major`, `goals` and preferred time. Notes remain local; only topic selections and preferred time influence deterministic recommendations. Old plans, RSVP confirmations and posts are preserved. Evidence is intentionally not restored after reload; current add-time validation remains mandatory. Replanning preserves strict constraints and never adds an alternative automatically. The dashboard weekly briefing, which called the planning endpoint twice, was removed on November 12, 2026.

Communities are static fictional TypeScript data, with local membership/posts. Event-community association uses exact catalog topics. No scraping, background jobs, new credentials or external services are introduced. Future watsonx remains a Rust interpreter adapter returning validated constraints and recognition status, with trusted event selection/evidence after interpretation.

Community memberships use browser-local `joinedCommunities` IDs independently of discussion joins in `joined`, whose values are post titles. Unknown stored community IDs are ignored. Event-to-community links use `#forum?community=<known-id>`; selected details follow URL changes and reloads. Older ambiguous `joined` values remain conversation joins and are not migrated into community memberships.

## Final proposal refinement

`data/demo.json` is the single build-time demo configuration (`campus_id`, `campus_name`, Monday `week_start`, IANA `time_zone`). Both builds consume it; rebuild frontend and backend together. `GET /api/config` exposes that same non-secret configuration. Frontend validates the Monday/date and IANA zone, derives all visible dates, and converts local event minutes to UTC for ICS using the configured zone instead of a fixed offset. Event IDs/data remain synthetic; campus labels use the configured fictional identity. Alternate campus/week/zone configurations have separate browser storage keys, preserving old plans rather than reinterpreting them. This is not real multi-campus tenancy or an interactive scenario switcher.

Rust and TypeScript selection now prioritize previously unrepresented requested/selected topics, while hard filters, current commitments, pairwise travel buffers, cancellations and access stay authoritative. Unknown RSVP requirements and invalid event times fail closed. Evidence adds `comparison`, `discovery_context` and `constraints_satisfied`. Comparisons reuse the in-memory trusted catalog and compare actual cost, duration and RSVP conditions of another eligible same-topic record; no record is claimed universally superior.

The interpreter adds optional `clarification`: ambiguous proximity/cost, unsupported weekday negation, and unqualified 1–12 clock hours ask a short question and return no selections. Unsupported recognition and understood/no-match remain distinct. Recognized empty results include an optional `diagnostic` explaining filter absence or counts of conflicting/restricted/cancelled/incomplete/already-chosen records within those filters. Browser fallback retains deterministic filters and makes no claim of Rust evidence or live IBM operation.

Settings → Team tools opens a read-only synthetic-data review, with missing source/URL, stale/missing verification, unknown eligibility/RSVP/food and invalid metadata flags. Reference date is the configured week, with a 30-day freshness threshold; this is a reproducible review heuristic, not external verification. No editor mutates trusted catalog state.

The Demo Scenario Launcher uses existing conversation/enrollment interfaces, explicitly archives the prior local demo before reset, and never pre-approves an RSVP or adds events. It keeps cancellation, replacement and export in the Planner view; Reset/Restore are explicit. See `docs/demo-script.md`, `docs/proposal-alignment.md` and `docs/evaluation-methodology.md`.

## Optional browser regression

The checked-in `scripts/browser-journey.mjs` exercises desktop/mobile journeys against a running built app. Playwright is optional test tooling, not an application dependency. Install it in an external tooling directory, then supply its module path, your Chromium binary, and the internal test URL:

```sh
npm install --prefix /tmp/campus-browser-tools --no-package-lock playwright
PLAYWRIGHT_MODULE=/tmp/campus-browser-tools/node_modules/playwright/index.mjs \
CHROMIUM_PATH=/usr/bin/chromium CAMPUS_TEST_URL=http://127.0.0.1:4173 \
node scripts/browser-journey.mjs
```

It uses isolated browser contexts and synthetic names. It checks manual RSVP, replacement consent, ICS download, archival restoration, clarification, review filters and horizontal overflow. No full accessibility certification is claimed. `npm run evaluate` starts its own ephemeral Rust server independently; build Rust first.

## PR #4 clarification follow-ups

AM/PM interpretation omits ambiguous clock bounds rather than returning guessed values. The browser API raises a typed clarification carrying validated non-ambiguous constraints and unresolved clock phrases. Conversation ownership keeps that context pending (not persisted as an active plan) and resolves a single bare AM/PM answer or a full time answer before calling the Rust planner or labelled browser fallback. New chat/reset/replacement clears pending context. Multiple ambiguous clock phrases require an explicit full answer. Direct HTTP clients must provide the returned safe `constraints` as `previous` with a fully specified follow-up such as `after 3 PM`; the server remains stateless.

Only the existing boolean free-admission cost filter is supported. Numeric price/budget requests such as `under $5` are explicitly rejected: browser interpretation surfaces an unsupported-budget error without making a request; direct Rust requests return a clarification with zero event IDs. General clarification no longer solicits a maximum budget. Other non-clock clarifications explicitly require restating the full request. No maximum-cost field has been introduced, and no numeric budget may be treated as satisfied.

The Rust `matches_constraints` predicate is shared by selection, same-topic comparisons and no-match diagnostics, covering topic, excluded topic, weekday, start/end, food and free admission. Existing API/fallback parity and the frozen evaluation report remain unchanged; conversation-level tests cover clarification follow-ups independently.

Monetary detection excludes supported inclusive result-count phrases (`up to`, `at most`, `no more than` followed by 1–5 events/options/choices). Count parsing still reads the original message. A separate money/budget phrase in that message continues to reject numeric budgeting; event counts do not disable the monetary check.

## Multi-part clarification policy

Generic unresolved conditions (weekday exclusions, proximity/location, vague cost/time) take precedence over clock-only clarification in both interpreters. Their response requires a full restatement and clears the unsafe positively parsed day filter. The browser's typed pending clarification records this restatement requirement as well as all unresolved clock phrases. Bare AM/PM or a clock-only reply cannot bypass a remaining generic condition; the full restatement must supply a topic, positive weekdays and all requested explicit clock bounds. Unsupported conditions must be removed or restated in supported terms, never inferred as satisfied.

For multiple pending clock bounds, the conversation checks every bound against the new answer. A partial answer leaves pending context intact, emits no suggestions and does not commit guessed or partial constraints. Newly introduced clock bounds are also required in the final full answer. Once all bounds are explicit, normal Rust/browser matching runs against the latest schedule with original non-ambiguous topic/day context. An explicit full restatement of a mixed request replaces unsafe pending filters. New chat/reset or an explicit fresh prompt intentionally cancels pending requirements. Server endpoints remain stateless; direct clients must retain unresolved requirements between calls or require a full restatement themselves.

The checked-in browser journey starts a new chat between unrelated clarification examples. Multi-turn API/workflow regressions independently test repeated partial answers, both clock orderings, mixed conditions, completed answers and unchanged calendar/RSVP state online and offline.

## My Preferences contract (schema version 1)

The one browser demo state retains canonical interests/preferred time/major/raw goals/blocks/buffer and adds a versioned `preferences` object for new choices. `migratePreferences` supplies disabled goal/learning defaults without converting legacy free text into confirmed topics. Save updates only editable fields on the latest state, clears stale draft/current filters, and preserves plan/RSVP/community data. Active preference revisions invalidate requests, proposals and old clarification context. Raw notes and provenance remain local; `wirePreferences` sends only the minimum supported structured fields.

Schedule requests may include `preferences`: `version:1`, `goal_topics`, `primary_topics`, `learning_topics` (known topic arrays), `participation` (independent/one-to-one/small-group/open), `guidance` (few/first/steps/information/none), `count` (1/3/5), `free_only`, `windows` (day/start/end, at most 20) and `dismissed` (known event IDs). Missing preferences preserve legacy behavior. Serde rejects unknown fields (including raw notes), invalid enum/version/count/window values, and primary topics outside enabled goals. Inputs remain bounded by the existing request limit. No server-side profile/database or note logging was added. The browser omits guidance from outgoing payloads because it only affects local presentation; the optional legacy field is still validated server-side.

The Rust planner and fallback use the ranking weights documented in `docs/preferences-design.md`: active/current topic 10, unrepresented matching topic 4, learning topic 6, enabled goal topic 3, primary topic 2, explicit participation match 2, preferred time 2, free admission 1. Stable ties use weekday/start/event ID. Current topics restrict candidates, not hard requirements. `explore:true` explicitly seeks beyond active saved topics; a newly stated topic clears this soft search mode. Current-request result counts can replace the saved default count; neither is an attendance quota.

Saved free-only and preferred availability windows apply only to recommendation selection, comparisons and no-match explanations. Validation/enrollment and planned-event validity use real eligibility, cancellation and scheduling rules; a paid or outside-preference event remains an explicit choice when those rules pass. Changing these preferences does not invalidate existing plans or bypass RSVP. Unknown participation metadata has no preference bonus; fixture participation is a typed fictional enum including Unknown. Evidence includes confirmed learning and participation facts with uncertainty, and uses “No conflict with the commitments you entered.” Guidance changes evidence expansion and next-step text, never inferred ability.

Dashboard and briefing use the same planning endpoint with stale-result suppression. This-search-only chat proposals retain the original request's explicit time/practical filters and require no lasting update. Review and save names the exact broad tags, enablement and conversation provenance, and requires confirmation. Show another and Not for me use session-only exclusions; neither stores a new persistent dismissed ID. Existing legacy hidden IDs remain compatible and explicitly restorable. Local message snapshots never restore deleted preference tags. No browser raw reflection/learning/major/goals notes are sent by the preference projection.

Optional browser regression: with the app running, `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROMIUM_PATH=/usr/bin/chromium CAMPUS_TEST_URL=http://127.0.0.1:4173 node scripts/browser-preferences.mjs`. It checks desktop online/mobile fallback Save/Cancel/reload, learning opt-in/disable, two participation/guidance profiles, one-off vs confirmed chat, RSVP, preserved plans, hard empty results, note-payload minimization and overflow. The existing `scripts/browser-journey.mjs` still exercises cancellation/replacement/export.

Contract-only refinement: `RecommendationPreferences` and `RecommendationSchedule` explicitly describe the allowlisted TypeScript request projection. Existing typed participation metadata defaults to Unknown when absent, and invalid Rust enum values are rejected. Goal matching continues to use authored catalog `topic` plus the existing explicit structured-goal mapping; no extra event suitability field or title inference is necessary. No ranking weights, filters or tie-breaking changed. New regression coverage checks missing preference objects, labelled/unlabelled busy blocks, explicit/absent/invalid participation metadata, collection bounds, numeric-only result counts, and outgoing note/title exclusion.

## Structured scoring parity

`planner::ranking_details` is shared by Rust selection and the new optional `/api/plan` response field `match_reasons`: `{event_id, score, matches:[{kind,points,explanation}]}` for every selected event in order. Diversity is calculated against earlier suggestions only. The exact table, mappings, count/tie rules and documented boundary differences are in `docs/preferences-design.md`. The frontend validates these bounded explanations without changing approval or fallback safeguards; older responses omitting them remain compatible.

Focused verification: `cargo test --locked` (12 tests), `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, `cargo build --locked`, `npm run typecheck`, `node --import tsx --test tests/api.test.ts tests/fallback-preferences.test.ts` (23 tests), and `node --import tsx tests/preference-parity.ts` (18 shared comparisons plus 6 server safeguards). No LLM or Python backend was added.

The three recommendation surfaces now share `useRecommendations`/`requestPlan` and bounded `readMatchReasons`/`readCatalogEvidence` decoding. Local chat messages retain structured reasons, evidence and a note-free settings identity; none is included in schedule requests. Preference-key changes invalidate current responses and pending conversations. Historical suggestions are explicitly marked, with a refresh action that preserves messages and chosen plans. Optional browser check: `node scripts/browser-preference-surfaces.mjs` with the Playwright/Chromium environment above; it exercises desktop online/mobile fallback and a delayed obsolete response.

## Discovery versus plan-building

`Constraints.mode` is optional and validated as `discovery` or `plan-building` (Rust enum, matching TypeScript union). Omission preserves the legacy plan-building default. Discovery skips only mutual compatibility between unplanned suggestions; both modes still run all event validity, access/RSVP metadata, cancellation, existing plan, busy commitment, travel-buffer and saved/current hard-filter checks. Plan-building additionally requires every suggestion to fit every earlier suggestion. Scores, count semantics and tie-breaking are unchanged.

Ordinary Planner chat, Dashboard and the main briefing default to overlap-free plan-building, matching both planners when mode is omitted. Follow-ups and Show another retain an explicitly selected mode. Discover alternatives and explicit discover/browse/explore wording select discovery; the Across disciplines briefing and Explore outside my interests control also explicitly request discovery. Weekly-plan wording and Build weekly plan select plan-building. Schedule replacement uses plan-building with its existing one-result limit. Refresh preserves the selected message’s original mode (or an explicit override) and resolved filters with current preferences. Discovery options are labelled as alternatives, with named overlap warnings; they are never presented as a combined compatible schedule. `/api/plan` reports interpreter mode (`simulated` or `watsonx`) at the root; selection mode independently remains under `constraints.mode`.

Discovery cards identify actual overlapping alternatives (including insufficient selected travel time) by known catalog title, and state that both cannot fit the schedule. Chat stores its selection mode so historical alternatives remain labelled. Latest-schedule validate/enroll checks and explicit RSVP confirmation are unchanged: adding one alternative prevents adding its conflicting partner.

Focused verification: 13 Rust tests, formatting/Clippy/build, frontend build/type checking, focused mode/API/workflow/presentation tests, 22 shared fixture/interpreter/goal comparisons and the mobile mode-switch browser check passed. Optional browser script: `scripts/browser-recommendation-modes.mjs`; shared comparison remains `node --import tsx tests/preference-parity.ts`.

Brief onboarding now renders `MyPreferences` in brief mode over the existing draft and section components. No new preference contract/store or backend code was needed. `useRecommendations` exposes retry for its current request key and suppresses misleading empty states during loading. Focused optional browser check: `scripts/browser-brief-setup.mjs` (shared setup, keyboard/focus, save/skip, mobile, session-only rejection and loading/error recovery).
Partial clarification replies merge safe interpreted context into the existing pending requirements. Every recognized clock bound is retained even when its numeric value is unresolved; new ambiguous values remove older numeric guesses. New generic ambiguity promotes the full-restatement requirement and removes unsafe day filters. The shared evolving-clarification fixtures exercise this state merging through workflow and real API tests online and offline.

## Rust ranking reuse

`recommend_with_details` builds one active-topic snapshot per operation and returns borrowed event references paired with their winning `RankingDetails`. Each feasible candidate is scored once per selection round; comparisons borrow IDs and retain the existing score/day/start/ordinal-ID/original-index order. `plan` serializes these retained details and calls `evidence_with_topics` with the same snapshot. Public `recommend`, `ranking_details` and `evidence` remain backward-compatible wrappers, with no persistent cache or API schema change. Twenty pre-refactor complete API fixtures lock selection, scoring, explanations and evidence; integration tests compare complete response bodies.

## Match-reason field naming and compatibility

`POST /api/plan` emits only the snake-case `match_reasons` field (an array, including `[]` for no recommendations). Each entry retains `{event_id, score, matches:[{kind,points,explanation}]}`, with unchanged order and content. The camel-case wire field is no longer emitted. In-repo clients previously treated explanations as optional, so missing explanations did not prevent planning. Older frontend bundles can continue planning against the new service but may omit explanations until upgraded.

For mixed-version deployments, the TypeScript API adapter accepts the legacy server field `matchReasons` only when `match_reasons` is absent. The canonical field wins when both exist; invalid canonical content fails validation rather than falling back to the legacy alias. Responses omitting both still produce an empty explanation list. Local API-adapter results, React props and stored chat snapshots retain `matchReasons`; this wire migration does not rename local state. All existing bounds, weights and reason validation remain in effect. The pre-optimization API fixture changes only this response key, retaining the original payload arrays.

## Main/Doris integration resolution

The provider-aware handler from main owns interpretation, health and optional watsonx fallback notices. After validating constraints, both interpreter paths use `recommend_with_details` and serialize the same canonical `match_reasons` contract without rescoring winners. `evidence_with_topics` shares the batch topic snapshot. The watsonx module and startup configuration are unchanged from main; no additional model protocol was assumed. Simulated response fixtures, live/fallback mock routes and frontend mode/notice validation are checked together.

## Review refinement: explicit continuation and deterministic intent

`POST /api/plan` accepts optional `continuation: boolean` (default `false`). It is a structured request-context signal, not a special message string. Browser clarification answers, Refresh and Show another send `true`; ordinary typed requests send no continuation flag. The request hook also sends `true` when reusing explicitly supplied structured filters. `Find events` has no special exploration meaning. Single-clock AM/PM answers are expanded to the pending explicit clock phrase for stateless interpretation, retaining the pending structured context. Multi-bound and generic-ambiguity safeguards still apply; a recognized fresh standalone request can abandon pending clarification.

Temporary `explore:true` and its discovery mode are retained during continuation, but ordinary requests end that temporary exploration. Explicit new topic and reset rules still apply during continuation: choosing a supported topic ends beyond-interest matching, and reset/start over always clears constraints. A leading build/create/make/plan request for a plan/schedule/week takes precedence over incidental explore wording in its purpose. Thus `Build my weekly plan to explore career options` constructs a compatible schedule, while `Explore social events to make friends this week` returns discovery alternatives. Omitted selection mode remains overlap-free plan-building.

The server runs deterministic interpretation first, retaining its `mode` and `explore` values when accepting watsonx extraction. Model output cannot replace these policy fields, including their intentional absence after reset or a new ordinary request. Other supported model-extracted filters retain the existing validation and deterministic scheduling path. Clarifications bypass the model. Local HTTP model/IAM mocks verify dispatch and conflicting/missing policy fields; they do not verify a real IBM model's behavior.

Schedule projection optionally includes `view_excluded: string[]`, bounded to catalog size and validated against known IDs. This ephemeral Dashboard category/query projection is separate from `preferences.dismissed`, which combines real saved and current-search dismissals. It affects recommendation candidates and comparisons, never explicit validation or enrollment. Empty results classify real scheduling/access issues before view filtering, beyond-interest exclusion and dismissals, consistently in Rust and the browser fallback. Category/query exclusions suggest changing the category/search; they do not suggest restoring hidden preferences. Older clients can omit both new request fields; deploy the updated frontend and backend together.

Conversation-reset identity now includes recommendation preferences, interests, preferred time and travel buffer, but excludes chosen/cancelled events and actual busy commitments. The full scheduling projection remains in request identity and stale-response checks. Schedule mutations therefore invalidate obsolete results without unnecessarily erasing clarification context or current-search skips. Actual recommendation-setting changes still reset that context. Guidance and raw notes remain excluded from the recommendation projection. App memoization follows immutable state/dependency changes; no cross-action cache is introduced.

Fresh verification and limits are recorded in [latest-review-verification.md](latest-review-verification.md).


## Combined main and Doris contract — November 12, 2026

The current handler retains main's two-stage provider architecture. It applies and validates synthetic updates to a request-local effective catalog/schedule, runs deterministic safety/intent rules, optionally extracts constraints through watsonx, selects feasible candidates with enabled structured preferences, and optionally asks watsonx to rank those candidates and write cited narrative reasons. Model policy cannot override deterministic `mode`/`explore` decisions. Ranking is restricted to selected feasible IDs, so count, real eligibility, existing commitments and plan compatibility remain protected. Profile goal coverage and host-school disclosures from main remain. Failed extraction/ranking uses the corresponding labelled simulated/template fallback; configured service status does not establish live verification.

`POST /api/plan` additionally accepts main's optional `profile: {major, goals, goal_types}`. Major and goals are bounded to 120/240 Unicode characters; goal_types is bounded to the four validated values research, industry, social connection and cultural exploration. The browser sends empty profile values unless `profileRankingConsent === true` was explicitly saved in My Preferences. That opt-in covers only these named fields, not reflection, learning, biography or arbitrary local notes. Direct API callers retain main's explicit profile contract and must obtain appropriate consent before submitting profile context. No authentication/account consent registry or production integration was added.

`state.applied_update_ids` is carried alongside optional structured `preferences` and transient `view_excluded`. Rust and the TypeScript snapshot validate against effective moved times/full/cancelled events. Full updates report fullness, rather than being relabelled as cancellation. Busy titles stay out of modern payloads; older labelled blocks remain accepted. Explicit event additions/enrollment remain independent of soft saved free/window preferences but always revalidate real eligibility, RSVP and the latest schedule.

Responses retain main's root `mode`, `provider`, `explanations`, model `ai_reason` and `cited_fields`, together with Doris's canonical `match_reasons`. The client validates and stores bounded narrative and structured evidence. `matchReasons` is accepted only as a legacy response alias. The second-stage narrative/order is model-generated; the numeric match reasons continue to describe deterministic candidate selection, not a claim about model scoring. Model failure does not fabricate AI-written reasons.

Fresh user searches use main's fresh-filter behavior. Explicit follow-up wording and clock-bound replies retain applicable context; structured `continuation` is used for clarification, Refresh, Show another and chip reruns. Refresh uses the selected message's resolved constraints, never unrelated global defaults. Multiple-clock and full-restatement safeguards remain. Overlapping alternatives and one-filter-relaxed previews stay visibly separate from a mutually compatible plan; they never add themselves. Alternative-card selection also respects enabled preferences and real saved/session dismissals. Conversation reset identity excludes schedule mutations while full in-flight request identity includes schedule/update IDs and approved profile context.

The Profile editor and My Preferences share the existing store. Old notes/goals are preserved but never treated as profile-ranking consent. `preferencesConfigured` distinguishes main's untouched eight-card Home default from a saved Doris 1/3/5 result count; migrated active Doris preferences keep their prior count. No saved events, plans, RSVP records, communities or messages are cleared by migration. Main deliberately removed the old Dashboard briefing; no obsolete Dashboard request hook is left running. The former Profile form's major/goals/goal-type inputs are consolidated in My Preferences, preserving their functionality without introducing a second editor/store.

The current verification record distinguishes current-catalog API snapshots from untouched historical ranking snapshots tied to their original catalog. The frozen evaluation scenarios/hash are unchanged; generated evaluation results/report were refreshed for this combined catalog and planner.
