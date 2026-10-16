# Campus Compass

A classroom campus-event planning demo for the IBM AI Experiential Learning Lab. Preserve fictional data, explicit student approval before calendar additions, and honest simulated-mode labels. Live watsonx is deferred; do not claim Bob development work unless the team actually performed and recorded it.

## Technology and structure

Use Rust for backend services and API endpoints, including future watsonx integration. Do not implement backend application code in Python. Use React and TypeScript for frontend source; JavaScript is the compiled browser runtime and may be used for tooling.

- `backend/src/`: Axum API, typed input validation, interpreter and deterministic scheduling.
- `frontend/src/`: React components, typed API client, browser-local state and labelled simulation fallback.
- `data/events.json`: shared fictional catalog. Rebuild both sides after edits.
- `dist/`: generated frontend output; edit source and run `npm run build`.

Read `docs/backend.md` when changing application architecture, API contracts, the interpreter, or local run/test setup. Keep the Rust and TypeScript fallback matching behavior aligned; the API integration test compares them. Revalidate against the latest schedule before adding an event or accepting asynchronous recommendations. Keep IBM secrets server-side.

## Commands

Install with `npm ci`. Build with `npm run build`; start with `cargo run --locked`. For frontend development, run `npm run dev` alongside Rust. Before shipping application changes, run `npm test`, `npm run build`, `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, `cargo test --locked`, `cargo build --locked`, and `npm run test:api` as appropriate to the change.

## Documentation and Bob

Before each push, update README.md with the completed changes, teammate run/demo instructions, verification results, and material limitations. Commit completed work with a descriptive message.

Place new project documentation in `docs/`, except GitHub Wiki sources in `wiki/`. Edit existing documents in place unless the user requests reorganization. Keep agent instruction entrypoints at their tool-required paths.

Read `docs/github-wiki.md` when changing Wiki publishing. Read `docs/ibm-bob-setup.md` when initializing or refreshing Bob project context with `/init`.
