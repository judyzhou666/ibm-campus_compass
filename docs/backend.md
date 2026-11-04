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
- `frontend/public/assets/mascot.png`: unchanged supplied mascot.
- `data/events.json`: single shared fictional event catalog.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Reports the configured `mode` and `provider`, `watsonx_configured`, and `watsonx_connected` (true only after the latest live call succeeded). |
| `POST /api/plan` | Accepts `message`, `previous` constraints and `state`; returns validated constraints, trusted `event_ids`, the `mode` (`simulated` or `watsonx`) and `provider` that actually answered, and an optional fallback `notice`. |
| `POST /api/validate` | Accepts `event_id` and latest schedule `state`; returns `allowed` and `issue`. |
| `POST /api/enroll` | Accepts `event_id`, latest `state`, and optional `rsvp`; checks access/conflicts and mandatory RSVP, then returns a simulated enrollment confirmation. |

Schedule state contains `plan`, `cancelled`, `interests`, `blocks` and `buffer`. Busy blocks contain title, day (Monday = 0), and start/end minutes after midnight. Planning and validation requests omit display names, discussion posts and chat history. Enrollment sends only the RSVP form’s demo display name and attendance confirmation alongside the schedule snapshot. Only known event IDs and topics are accepted. JSON bodies are capped at 32 KiB; messages at 2,000 bytes. Travel buffers are 0 or 15 minutes.

The frontend rechecks the current schedule before accepting asynchronous results. Reset invalidates pending planning and enrollment requests; new-chat invalidates planning requests. Additions always require a student action and are checked again against current state. Backend requests do not create real RSVPs or persist a shared calendar.

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

Rust tests in `watsonx.rs` and `lib.rs` use a local mock IAM and watsonx.ai server, so no IBM credentials are needed to run them. The live contract has not yet been exercised against a real account; see `WATSONX-NEXT-STEPS.md` for the live acceptance checklist.

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
