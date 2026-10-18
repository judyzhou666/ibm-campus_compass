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
