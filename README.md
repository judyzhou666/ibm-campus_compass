# Campus Compass

A campus opportunity planner that helps university students — starting with first-semester graduate students — discover academic, career and social events and fit them into a realistic week. Built for the IBM AI Experiential Learning Lab.

## Challenge track
**Bring Your Own Challenge.** Higher education is not one of the four listed tracks; this project names it as its own challenge statement.

## Problem statement

Universities already offer many academic, career and social opportunities, but they are fragmented across schools, departments and student organizations. Students must discover, interpret and coordinate scattered information themselves: Is this event relevant to me? Can students from another school attend? Is RSVP needed? Does it clash with my classes? Is there food? Organizers struggle to reach relevant students beyond their own channels.

The institutional benefits — improved resource discoverability, cross-school reach, reduced scheduling friction — are hypotheses to validate, not results. No student interviews or organizer research have been conducted yet.

## Who it serves first

| Role | Description |
|---|---|
| **Primary user** | University students exploring academic, career and social opportunities |
| **Initial sponsor user** | A first-semester graduate student unfamiliar with campus information channels (especially international students) |
| **Direct users** | Students browsing, planning and RSVPing |
| **Potential adopters** | Student-affairs and graduate-support offices |
| **Content partners** | Schools, departments, event organizers and student organizations providing approved event information |

**Proposed first pilot:** the University of Pennsylvania, where the team can reach users and verify sources. This is not the boundary of the product; institutions adopting or paying is not assumed.

## Solution

What the app does today, from the student's view:

- **Home** — announcement carousel, browse-by-category tiles (Academic, Career, Social, Workshops, Wellbeing, Arts, Free food), and a preference-ranked list of upcoming events.
- **Explore Events** — searchable, filterable event cards with access conditions, food, RSVP status and source provenance.
- **AI Planner ("Mimi")** — conversational chat with visible, removable filter chips and a draft-plan sidebar. The student approves every addition; every add re-checks the latest schedule. Optional watsonx mode (see below).
- **My Dashboard** — Weekly Calendar strip with week navigation; **Full Calendar** sub-page with Day/Week/Month/Year views.
- **Discussion Forum** — searchable communities, local posts, join/leave, related events.
- **Notifications** — bell dropdown, unread badge, filterable Notifications page, per-notification messages.
- **Settings** — time zone, 15-minute travel buffer, AI connection mode, demo reset, synthetic-data review (Team tools).

## Agentic AI approach

The planner is mapped to three of the lab's archetypes based on what is actually implemented:

| Archetype | How it shows up |
|---|---|
| **Context-Aware Expert** | Plans around the student's stated interests, existing busy times, travel buffer and synthetic event updates. Access conditions, conflicts and cancellations are re-checked on every add. |
| **Cognitive Load Reducer** | Turns scattered event listings into a short feasible week plan with plain "Why this fits" reasons for each pick (interest match, schedule fit, cost, RSVP status). |
| **Human–AI Boundary Manager** | Clarifies ambiguous requests (AM/PM, excluded days, unsupported budgets) before suggesting anything. Never adds an event without the student's explicit approval. Labels every reply with the mode that produced it (Simulated or IBM watsonx). |

## Technology

- **IBM Bob** — used to write the calendar Day/Week/Month/Year views (four rounds), the AI Planner filter fix (three rounds) and the first version of this README overview; review fixes and merges on top were made with Claude Code, as recorded per entry in [`docs/CHANGELOG.md`](docs/CHANGELOG.md). Exported Bob task histories: [`bob_sessions/`](bob_sessions/). Judy's review of the synthetic update feed is exported in `bob_sessions/Judy/`; Tingting's exports are still being added, so the work above is not yet backed by an export.
- **IBM watsonx.ai Granite** — optional live interpreter and ranker via `PLANNER_PROVIDER=watsonx`. Default is the deterministic simulated planner. Every reply is labelled with the mode that produced it.
- **Rust** (Axum, Tokio, Serde) — backend API, typed validation, deterministic scheduling logic.
- **React + TypeScript + Vite** — frontend; browser-local state; explicitly labelled simulation fallback when the backend is unavailable.
- **Fictional data** in [`data/`](data/) — 48 original fictional events; no real university records.

## Responsible AI and data

- Fictional events and profiles only; no personal information is collected or stored server-side.
- All state is browser-local; nothing is shared between users.
- Student approval required for every calendar addition.
- Deterministic validation runs after any model output; the model cannot invent event IDs or eligibility.
- Every reply is labelled with the mode that produced it (Rust planner · Simulated, Rust planner · IBM watsonx, or Browser fallback · Simulated).
- See [Data and assets register](#data-and-assets-register) below.

## Run it

Install Rust stable and Node.js 22.12+. From the repository root:

```sh
npm ci
npm run build
cargo run --locked
```

Open http://127.0.0.1:4173. The chat status label under AI Planner shows which planner answered: **Rust planner · Simulated** (default, no credentials needed), **Rust planner · IBM watsonx** (live Granite), or **Browser fallback · Simulated** (the server is not running).

For frontend development, run `npm run dev` alongside Rust.

**Demo week:** Nov 2–6, 2026, America/New_York time.

**To enable watsonx:**

```sh
cp .env.example .env    # fill in WATSONX_API_KEY and WATSONX_PROJECT_ID
set -a; source .env; set +a
npm run build
cargo run --locked
```

See [docs/backend.md](docs/backend.md) for full backend and watsonx setup, and the [Wiki — Using watsonx](https://github.com/judyzhou666/ibm-campus_compass/wiki/Using-watsonx) for step-by-step instructions.

## Three-minute demo

Follow [docs/demo-script.md](docs/demo-script.md). Start from **Settings → Reset demo**, then open AI Planner.

**Video:** TODO (team — add YouTube link before submission)

## Evaluation

[docs/evaluation-report.md](docs/evaluation-report.md) reports 20 frozen synthetic scenarios (12 development, 8 held-out) comparing keyword/category search, deterministic rules and the Rust context planner. The Rust planner has zero measured conflict or eligibility violations on this suite and achieves 100% diversity on development scenarios (85.7% on held-out, the same as the rules baseline). **Live watsonx: Not yet evaluated.** This is a small visible synthetic benchmark, not proof of live AI value or user benefit.

## Current limits

- **Fictional data only.** No real university events, registrations or calendar sync.
- **Simulated by default.** The deterministic planner requires no credentials. Live watsonx is optional and has not been evaluated against real queries.
- **No real RSVPs.** The demo RSVP dialog is fictional; no organizer receives it.
- **No external calendar sync.** `.ics` export only.
- **Browser-local state.** Nothing is shared between browsers or users.
- **Penn pilot is proposed, not started.** No user interviews or organizer research have been conducted.
- **Mascot asset provenance.** The cat image was supplied for this website. Its third-party license has not been independently verified; confirm before any broader public distribution.

## Team

Judy (Jinru Zhou), Shuozhuo (Doris) Wang, Chenxi Liu, Tingting Lai.

### Team branches

The shared starting branch is `main`. Individual work branches are `Judy`, `Doris`, `Bella`, and `Tingting` (case-sensitive). Start work on your own branch and open a pull request into `main` for team review.

```sh
git clone git@github.com:judyzhou666/ibm-campus_compass.git
cd ibm-campus_compass
git switch Judy
```

Replace `Judy` with your assigned branch name.

## Repository layout

| Path | Contents |
|---|---|
| `backend/src/` | Rust API, interpreters, planner, watsonx |
| `frontend/src/` | React + TypeScript UI, browser fallback |
| `data/` | Fictional catalog, demo week config, synthetic updates |
| `tests/` and `evaluation/` | API, fallback, scheduling, Wiki, and frozen evaluation scenarios |
| `docs/` and `wiki/` | Backend guide, demo script, evaluation, proposal alignment, Wiki sources |
| `bob_sessions/` | Exported IBM Bob task histories (required for judging) |
| `.env.example` | Server-side watsonx settings template |
| `WATSONX-NEXT-STEPS.md` | Live watsonx verification checklist |

## More

- [docs/CHANGELOG.md](docs/CHANGELOG.md) — full development log (40 entries moved from this README)
- [docs/](docs/) — backend guide, evaluation methodology, demo script, proposal alignment, wiki publishing
- [GitHub Wiki](https://github.com/judyzhou666/ibm-campus_compass/wiki) — teammate step-by-step guides (Getting started, Using watsonx, IBM Bob, Team workflow)
- [bob_sessions/](bob_sessions/) — exported IBM Bob task histories (required for judging)

---

## Data and assets register

All 48 event records were originally authored for this prototype. No campus websites, personal calendars, social media, confidential records or real student data were ingested. Event locations, communities, and discussion participants are fictional. Dates use a fixed demonstration week (Nov 2–6, 2026).

The cat image was supplied by the user for this website and is used unchanged. Its original third-party authorship/license has not been independently verified. Before public distribution beyond the team's intended demo, the team should record the original asset provenance/permission. No external images or fonts are loaded. Compass and interface icons are original SVG geometry; poster panels are original HTML/CSS typographic artwork.

Demo profile fields are editable and are stored only in the viewer's browser.

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

The API integration suite starts a temporary local Rust server; allow localhost listeners in your environment. Build the Rust binary and frontend before running it.

## GitHub Wiki

Wiki page sources live in [`wiki/`](wiki/). After changes merge into `main`, the Publish GitHub Wiki workflow updates the [project Wiki](https://github.com/judyzhou666/ibm-campus_compass/wiki). One-time credential setup and publishing details are in [`docs/github-wiki.md`](docs/github-wiki.md).
