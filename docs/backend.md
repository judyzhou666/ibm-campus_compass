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

`CAMPUS_ADDR` defaults to `127.0.0.1:4173`. `PLANNER_PROVIDER` defaults to `simulated`. Selecting any other provider stops startup with an explicit error; live watsonx is not implemented yet. No credentials are needed for this demonstration.

## Source layout

- `backend/src/main.rs`: listener, local address, provider selection, graceful shutdown.
- `backend/src/lib.rs`: API routes, JSON input boundaries, static serving.
- `backend/src/interpreter.rs`: asynchronous interpretation interface and Rust simulated parser; future watsonx adapter boundary.
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
| `GET /api/health` | Reports simulated mode and `watsonx_connected: false`. |
| `POST /api/plan` | Accepts `message`, `previous` constraints and `state`; returns validated constraints, `understood`, trusted `event_ids`, mode and provider. |
| `POST /api/validate` | Accepts `event_id` and latest schedule `state`; returns `allowed` and `issue`. |
| `POST /api/enroll` | Accepts `event_id`, latest `state`, and optional `rsvp`; checks access/conflicts and mandatory RSVP, then returns a simulated enrollment confirmation. |

Schedule state contains `plan`, `cancelled`, `interests`, `blocks` and `buffer`. Busy blocks contain title, day (Monday = 0), and start/end minutes after midnight. Planning and validation requests omit display names, discussion posts and chat history. Enrollment sends only the RSVP form’s demo display name and attendance confirmation alongside the schedule snapshot. Only known event IDs and topics are accepted. JSON bodies are capped at 32 KiB; messages at 2,000 bytes. Travel buffers are 0 or 15 minutes.

The frontend rechecks the current schedule before accepting asynchronous results. Reset invalidates pending planning and enrollment requests; new-chat invalidates planning requests. Additions always require a student action and are checked again against current state. Backend requests do not create real RSVPs or persist a shared calendar.

Request recognition belongs to interpretation, including synonyms such as “professional”, “ceramics”, “balance”, “snack” and “refreshment”, plus generic requests such as “options”. An unsupported request returns `understood: false` with no event IDs; the browser shows explicit guidance. A recognized request with no eligible matches returns `understood: true` and an empty list. Both interpreters reject invalid clock input, including invalid minutes and out-of-range AM/PM hours. The browser validates messages and constraints before choosing Rust or fallback, and validates constraints received from Rust. Rebuild both sides together for the added recognition field.

The browser's demo state is an observable store. Enrollment and conversation modules own their pending work and expose read-only status to React through `useSyncExternalStore`; views handle form rendering and navigation. Reset and unmount discard obsolete successes and failures without changing a newer request's busy status. Replacement preserves strict filters and checks validity before accepting a suggestion. Calendar removal goes through enrollment so RSVP state is cleared consistently. Workflow tests cross these same module interfaces with controlled fetch completion, rather than testing private tokens or refs.

Rust handles chat and replacement matching. TypeScript retains the same rules for instant event-card feedback and a portable static-demo fallback; integration tests compare the two implementations. An unavailable backend triggers an explicit fallback notice. Rejected input is shown as an error, not silently retried through the local planner.

## Demo RSVP and calendar state

For an event whose catalog `rsvp` value is `RSVP required`, enrollment requires `rsvp: { "display_name": "Demo student", "attending": true }`. The Rust endpoint rejects missing approval, blank names and names longer than 120 UTF-8 bytes with HTTP 422. Unknown events or invalid schedules fail validation; cancelled, restricted, full or conflicting events return HTTP 409. Eligible drop-in events need no RSVP object. Success returns `{ "event_id": "e1", "demo": true, "status": "enrolled", "rsvp_confirmed": true }` (the final flag is false for drop-in events).

This endpoint does not persist registrations or send messages. The browser adds an event to its shared plan only after confirmation and a second check against its latest schedule. Confirmed RSVP IDs persist locally with the calendar. Removing the event clears that confirmation; adding it again requires a fresh RSVP. Existing pre-update calendar entries are retained for compatibility. Chat cards store known event IDs, so details and availability are resolved from the current catalog and schedule.

Closing the form before submission changes nothing. Submitting locks enrollment controls until the request completes. If the backend is unavailable, the same mandatory fields and schedule rules are enforced locally and a visible notice identifies the local demo. Input/authorization/conflict rejections are surfaced instead of falling back. This is intentionally a single-browser simulation, not a secure enrollment or capacity management system.

## Future watsonx integration

Implement the interpreter interface in Rust using the verified IBM region, project/model, authentication and API contract. Keep credentials in server-side environment/secret storage. The adapter must return structured constraints and recognition status, never unvalidated event IDs; keep `Constraints::validate`, deterministic matching, and add-time validation after model output. Add timeout, authentication failure and malformed-output tests before enabling a live provider. See `WATSONX-NEXT-STEPS.md` for the integration checklist.

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

Browser state keeps the existing storage key with safe defaults for `onboarded`, `major`, `goals` and preferred time. Notes remain local; only topic selections and preferred time influence deterministic recommendations. Old plans, RSVP confirmations and posts are preserved. Evidence is intentionally not restored after reload; current add-time validation remains mandatory. Replanning preserves strict constraints and never adds an alternative automatically. The weekly briefing calls the same planning endpoint twice (interest suggestions and excluded-interest cross-topic suggestions); requests are invalidated when the schedule changes.

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

Partial clarification replies merge safe interpreted context into the existing pending requirements. Every recognized clock bound is retained even when its numeric value is unresolved; new ambiguous values remove older numeric guesses. New generic ambiguity promotes the full-restatement requirement and removes unsafe day filters. The shared evolving-clarification fixtures exercise this state merging through workflow and real API tests online and offline.
