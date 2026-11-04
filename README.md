# Campus Compass

A runnable demonstration for the IBM AI Experiential Learning Lab, based on the supplied Campus Compass proposal and dashboard/planner prototypes.

## Latest update — November 4, 2026: optional IBM watsonx interpreter

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

The startup line says which planner is active. `WATSONX_URL` defaults to `https://us-south.ml.cloud.ibm.com` and `WATSONX_MODEL_ID` to `ibm/granite-3-3-8b-instruct`; check that model is available in your watsonx project and set another Granite instruct ID if not. Leave `PLANNER_PROVIDER` unset (or `simulated`) for the credential-free classroom demo. Details: [docs/backend.md](docs/backend.md#ibm-watsonx-interpreter).

### Implementation notes

- `backend/src/watsonx.rs`: `WatsonxInterpreter` (IAM token caching, `POST /ml/v1/text/chat`, JSON-only parsing, validation, timeout) and its mock-server tests.
- `backend/src/interpreter.rs`: the `Interpreter` trait now returns `Result<Constraints, InterpretError>`; `SimulatedInterpreter::parse` is the deterministic rules.
- `backend/src/lib.rs`: `Provider` selection, per-request labelled fallback, and `app_with(provider)`. `backend/src/main.rs` reads `PLANNER_PROVIDER` and refuses to start watsonx mode without `WATSONX_API_KEY` and `WATSONX_PROJECT_ID`.
- `frontend/src/api.ts`: accepts `mode: "watsonx"` and the server's fallback `notice`; `planModeLabel` drives the chat status label.
- New dependency: `reqwest` 0.13 (rustls, no OpenSSL). The local dev machine also needed a Rust toolchain installed via rustup for this work.

### Verification and limitations for this update

All checks listed under [Verification](#verification) passed on November 4, 2026 (Rust: 12 unit tests; npm: 10 API/fallback tests and 5 Wiki publisher tests; API integration suite passed). Rust tests run against a local mock IAM and watsonx.ai server and cover: valid output, fenced JSON, token reuse, IAM and chat authentication failures, upstream errors, timeouts, non-object or unknown-field output (such as `event_ids`), out-of-range constraints, key redaction, and the labelled fallback through `/api/plan`.

**Not yet verified against a real IBM account.** The request format follows IBM's watsonx.ai API reference and common client libraries; the first live run may reveal model-ID, API-version or parameter differences. Run the acceptance prompts in `WATSONX-NEXT-STEPS.md` with real credentials before demoing live mode. This change was written with Claude Code, not IBM Bob.

## Previous update — October 15, 2026

The AI Planner now supports choosing events while keeping your schedule visible. This update builds on the Rust backend and React/TypeScript migration.

| Change | What teammates should expect |
| --- | --- |
| Calendar beside chat | The **My calendar** button at the top right of AI Planner toggles a calendar panel on the right without leaving the conversation. It replaces the draft sidebar while open. On narrow screens it stacks below chat. |
| Actions in AI responses | New recommendation messages contain event cards with **View details** and **Add to calendar** buttons. Added events show a disabled confirmation button. Unavailable events show the reason. |
| Mandatory RSVP | Adding an event marked **RSVP required** opens a registration dialog. A demo attendee name and an explicit attendance checkbox are required before **Complete RSVP & add** can succeed. Cancelling or pressing Escape leaves the calendar unchanged. |
| Automatic calendar updates | A successful addition immediately updates the planner panel, dashboard and main calendar. Drop-in events can be added directly. Removing an event also clears its demo RSVP confirmation. |
| Shared enrollment validation | Every Add entry point—chat, draft plan, dashboard, Explore Events and event details—uses the same flow. Rust and the offline TypeScript fallback both enforce RSVP and current availability. |

The registration dialog is a **demo RSVP page** inside the app. It does not contact an organizer, reserve a real seat, charge a fee, or send a confirmation email. Use a fictional display name. There is no external registration website or live calendar integration.

### Implementation notes for the team

- `frontend/src/PlannerPanels.tsx` contains the chat event cards, side calendar, and RSVP form.
- `frontend/src/App.tsx` coordinates additions, checks the latest schedule after an asynchronous request, and updates shared state only after successful demo enrollment. One enrollment runs at a time; reset invalidates pending results.
- `frontend/src/api.ts` sends enrollment requests and supplies the explicitly labelled offline simulation. Backend request rejections are never treated as offline success.
- `backend/src/lib.rs` exposes `POST /api/enroll`. The Rust event model reads each record’s RSVP requirement from `data/events.json`; the client cannot override it.
- Browser-local state now records confirmed demo RSVP event IDs and event IDs attached to new chat responses. Existing saved schedules are preserved. Old chat messages remain readable but do not gain buttons retroactively; send a fresh prompt to see the new cards.

## Run locally

Install Rust stable and Node.js 22.12+. From the repository root:

```sh
npm ci
npm run build
cargo run --locked
```

Open http://127.0.0.1:4173. Rust serves the React/TypeScript frontend and planning API. For frontend development, run `npm run dev` alongside Rust. Python is not required.

See [backend architecture and test commands](docs/backend.md) and [IBM Bob setup](docs/ibm-bob-setup.md).

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

The API integration suite starts a temporary local Rust server; allow localhost listeners in your environment. Build the Rust binary and frontend before running it. Coverage includes matching parity, restrictions, conflicts, cancellations, required/missing/invalid RSVP, completed RSVP, drop-in enrollment, request validation and static file boundaries. Browser-fallback tests verify that a rejected server request cannot bypass enrollment rules.

For this update, manual browser checks covered the calendar toggle without navigation, direct response details/add actions, incomplete and cancelled RSVP, successful RSVP, immediate drop-in addition, removal, and a 390px mobile layout without horizontal page overflow. For teammate acceptance, follow the walkthrough above and verify that your added event remains after reloading. Use Settings → Reset demo to restore the original demonstration.

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
