# Campus Compass

A runnable demonstration for the IBM AI Experiential Learning Lab, based on the supplied Campus Compass proposal and dashboard/planner prototypes.

## Run locally

No build or npm install is needed. From this directory:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173. Use an HTTP server; opening index.html directly as a file will not load ES modules reliably.

Run the deterministic planning checks with Node 20+:

```sh
node test.mjs
```

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
4. Add “Learning with AI: a hands-on lab.” Show it in My Calendar.
5. Return to AI Planner → Simulate event cancellation → Find a replacement. The Thursday open studio is offered; other confirmed choices are retained.
6. Add the replacement. Export the calendar. Cancelled records are excluded and exported titles are marked [DEMO].
7. Select “A social event with free food.” Example prompt buttons begin a fresh request; typed follow-ups retain prior filters. Show that free meals and coffee/snacks are distinct.
8. Close by stating the limitations: fictional data, simulated chat, no external calendar connections, watsonx to be integrated later.

## Current boundaries

This version uses a deterministic parser and template responses. It is not a general-purpose language model or a live IBM-powered chatbot. Ambiguous natural language and unsupported constraints may not be understood; use the example prompts for the demo. “Start over” clears prior chat filters. It does not create real RSVPs, send messages, or sync calendars. Local discussion posts are not shared. Data is fixed, not live or fetched daily. The institution and business outcomes in the proposal remain hypotheses.

IBM Bob is a development assistant. This implementation was created in Codex and is not evidence of IBM Bob use. Your team should perform and document genuine Bob-assisted development/testing before describing the course's Bob component as fulfilled. The user has IBM watsonx access and chose to integrate it later.

## Files and extension point

- `dist/data.js`: fictional event schema, 30 records, sample commitments, date/time helpers.
- `dist/planner.js`: structured constraints, retrieval/ranking, deterministic conflict and access validation.
- `dist/app.js`: UI, simulated chat controller, local storage, cancellation and calendar export.
- `dist/styles.css`: responsive visual system.
- `dist/assets/mascot.png`: unmodified user-supplied mascot.
- `test.mjs`: deterministic engine checks.
- `WATSONX-NEXT-STEPS.md`: integration boundary and proposed next steps.

## Data and assets register

All 30 event records were originally authored for this prototype. No campus websites, personal calendars, social media, confidential records or real student data were ingested. Event locations, communities, and discussion participants are fictional. Dates use a fixed demonstration week.

The cat image was supplied by the user for this website and is used unchanged. Its original third-party authorship/license has not been independently verified. Before public distribution beyond the team's intended demo, the team should record the original asset provenance/permission. No external images or fonts are loaded. Compass and interface icons are original SVG geometry; poster panels are original HTML/CSS typographic artwork.

Names in the team credit were supplied or inferred from the user's account context. Demo profile fields are editable and are stored only in the viewer's browser.

## Verification

Syntax checks and `node test.mjs` passed. Browser walkthrough verified prompt matching, event addition, cancellation, replacement, and visible calendar state. Desktop (1440px), intermediate (595px), and mobile (390px) views were inspected. The export action was exercised and showed success; the in-app browser did not expose a completed download path to the automation tool, so an external calendar import was not verified.

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
