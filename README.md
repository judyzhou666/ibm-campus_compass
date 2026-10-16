# Campus Compass

A runnable demonstration for the IBM AI Experiential Learning Lab, based on the supplied Campus Compass proposal and dashboard/planner prototypes.

## Latest update — October 15, 2026

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
8. Close by stating the limitations: fictional data, simulated chat, no external calendar connections, watsonx to be integrated later.

## Current boundaries

This version uses a Rust deterministic parser and template responses, with a labelled TypeScript fallback when the backend is unavailable. It is not a general-purpose language model or a live IBM-powered chatbot. Ambiguous natural language and unsupported constraints may not be understood; use the example prompts for the demo. “Start over” clears prior chat filters. It does not create real RSVPs, send messages, or sync calendars. Local discussion posts are not shared. Data is fixed, not live or fetched daily. The institution and business outcomes in the proposal remain hypotheses.

IBM Bob is a development assistant. This implementation was created in Codex and is not evidence of IBM Bob use. Your team should perform and document genuine Bob-assisted development/testing before describing the course's Bob component as fulfilled. The user has IBM watsonx access and chose to integrate it later.

## Files and extension point

- `backend/src/`: Rust Axum API, simulated interpreter, schedule validation and event matching.
- `frontend/src/`: React/TypeScript UI, typed API calls, local persistence, calendar export and explicit browser simulation fallback.
- `data/events.json`: shared catalog of 30 fictional events.
- `frontend/public/assets/mascot.png`: unchanged supplied mascot.
- `dist/`: generated build output, ignored by Git.
- `tests/` and `test.mjs`: API, fallback, scheduling and Wiki publisher checks.
- `WATSONX-NEXT-STEPS.md`: future Rust integration checklist.

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
