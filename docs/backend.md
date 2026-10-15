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
- `frontend/public/assets/mascot.png`: unchanged supplied mascot.
- `data/events.json`: single shared fictional event catalog.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Reports simulated mode and `watsonx_connected: false`. |
| `POST /api/plan` | Accepts `message`, `previous` constraints and `state`; returns validated constraints, trusted `event_ids`, mode and provider. |
| `POST /api/validate` | Accepts `event_id` and latest schedule `state`; returns `allowed` and `issue`. |

Schedule state contains `plan`, `cancelled`, `interests`, `blocks` and `buffer`. Busy blocks contain title, day (Monday = 0), and start/end minutes after midnight. Display names, discussion posts and chat history are not sent. Only known event IDs and topics are accepted. JSON bodies are capped at 32 KiB; messages at 2,000 bytes. Travel buffers are 0 or 15 minutes.

The frontend rechecks the current schedule before accepting asynchronous results. Reset/new-chat invalidates pending requests. Additions always require a student action and are checked again against current state. Backend requests do not create real RSVPs or persist a shared calendar.

Rust handles chat and replacement matching. TypeScript retains the same rules for instant event-card feedback and a portable static-demo fallback; integration tests compare the two implementations. An unavailable backend triggers an explicit fallback notice. Rejected input is shown as an error, not silently retried through the local planner.

## Future watsonx integration

Implement the interpreter interface in Rust using the verified IBM region, project/model, authentication and API contract. Keep credentials in server-side environment/secret storage. The adapter must return structured constraints, never unvalidated event IDs; keep `Constraints::validate`, deterministic matching, and add-time validation after model output. Add timeout, authentication failure and malformed-output tests before enabling a live provider. See `WATSONX-NEXT-STEPS.md` for the integration checklist.

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
