# Connecting IBM watsonx later

The user has watsonx access but chose to complete the website demonstration before integrating it. No credentials are required by the current demo, and no IBM connection is claimed.

## Recommended boundary

Keep the website's event records and deterministic constraints. Extend the Rust server endpoint that interprets student requests using the team's available watsonx model. Keep frontend application code in TypeScript or JavaScript. The backend should own credentials; never put an IBM API key into browser JavaScript, a public repository, or localStorage.

Proposed flow:

1. Browser sends the message, prior structured constraints, and fictional profile to a server endpoint.
2. Server requests a structured interpretation with topics, included/excluded weekdays, time windows, maximum cost, food requirements and unknown/ambiguous fields.
3. Validate the returned object against an explicit schema. Ask for clarification when intent is ambiguous or unsupported.
4. Apply deterministic matching and conflict checks from `backend/src/planner.rs` on trusted event records. Do not let the model fabricate event IDs, eligibility or food availability.
5. Generate a short explanation based only on the validated records. Return draft event IDs and reasons.
6. Keep Add to calendar as an explicit student action; validate again at add time.
7. Preserve the current simulation as a fallback if the live service is unavailable, and display the actual mode honestly.

The React chat controller in `frontend/src/App.tsx` calls the Rust `/api/plan` endpoint through `frontend/src/api.ts`. The asynchronous `Interpreter` interface in `backend/src/interpreter.rs` is the future watsonx boundary. Its current implementation is simulated; retain constraint validation, deterministic matching and `/api/validate` when adding the live adapter. See `docs/backend.md`.

## Before implementation

Determine the IBM region/service URL, project or deployment, permitted model, authentication method, and account restrictions with the team's IBM console and current official documentation. Do not infer these from product names alone. Then supply secrets through the chosen host's secret settings and test with only fictional data.

IBM Bob can help the team implement that server endpoint and extend tests. Keep a short evidence log of actual prompts, generated changes, reviews, tests, and team decisions. Do not claim this code was built with Bob before that work happens.

Official starting point for the Bob distinction: https://bob.ibm.com/docs/ide

## Acceptance tests for the live version

- “AI research and a social event, Tuesday/Thursday only” respects both schedule and interests.
- “No food requirement anymore” clears the prior meal filter.
- “I cannot do Tuesday” excludes Tuesday; ambiguous timing triggers clarification.
- Cancelled, full, restricted and unknown-access events are never silently accepted.
- A fabricated event ID is rejected.
- Model or network failure falls back with a visible mode label.
- User edits during generation are validated against the newest schedule before adding.
- No secret appears in client source, requests to the browser, or logs.

## Minimal safe adapter plan after the deterministic evaluation

The smallest boundary remains Rust `Interpreter::interpret`: validated prior constraints and a bounded message in; structured `constraints`, `understood` and optional `clarification` out. Recognition alone never authorizes event selection. Rust matching/evidence and add-time validation remain downstream and authoritative. Do not move backend logic into Python or call IBM from the browser.

1. Verify the actual IBM region/HTTPS endpoint, project/deployment, allowed model and authentication contract using current official documentation and account settings. Supply credentials only through server-side environment/secret settings. Do not paste values in chat or commit them. IAM token acquisition/refresh belongs to the Rust server; redact authorization headers, prompts containing personal data, token responses and secrets from logs.
2. Send only the current bounded synthetic message and necessary structured prior constraints. Do not send names, RSVP names, posts, browser history or the full profile. Include only the allowed topic/time/cost/food schema, not fabricated event IDs.
3. Deserialize with Serde `deny_unknown_fields`, validate ranges/enums and maximum output size, and reject model-selected IDs, unsupported fields, impossible times and contradictory instructions. Clarify missing AM/PM, location or unsupported filters; never silently guess eligibility.
4. Use an explicit network timeout (within the client request budget), bounded retries for retryable errors only, and typed distinctions for authentication, service/network timeout and malformed output. Test each with controlled fake responses before any authorized live smoke test. Fail closed on authorization/validation errors.
5. On timeout/service failure offer a clearly labelled deterministic simulation. Never label a fallback as watsonx-generated. Expose actual provider/mode and preserve consent and latest-schedule validation across asynchronous replies. A future live provider needs a deliberate API mode change; current code rejects live mode.
6. Run `npm run evaluate` as the frozen deterministic comparison, then run live-model cases separately with model/version, parameters, latency, token/cost measurements and failures. Add unseen held-out language and human explanation ratings before making AI-value claims. Current model-dependent results are **Not yet evaluated**.

This is an implementation plan, not evidence of a working IBM connection. IBM Bob development evidence remains separate: record real team prompts, reviews and tests only after that work occurs.
