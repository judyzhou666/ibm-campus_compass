# Three-minute Campus Compass demonstration

This is a repeatable fictional journey, not a real university or live IBM demonstration. Run `npm ci`, `npm run build`, and `cargo run --locked`; use the Rust-served app. No credentials are needed. Go to AI Planner → open **Demo tools (for presenters)** at the bottom of the page.

| Time | Presenter action | Say / show |
|---|---|---|
| 0:00–0:25 | Prepare scenario → confirm. Expand Student context and limited availability. | “A fictional first-semester learning-sciences graduate student wants AI/research, career and social opportunities. Classes and a travel buffer limit availability. No career goal is required. Notes about major/goals stay local and are not interpreted.” |
| 0:25–0:50 | Recommend across interests. | Show three feasible topics rather than a single cluster. All selections use deterministic Rust rules; they are not watsonx responses. Explicit filters and access checks outrank diversity. |
| 0:50–1:20 | Read one card’s evidence and comparison. Open View details, then close it. | Show time/buffer fit, cost, location, RSVP, food distinctions and remaining uncertainty. “These are original fictional records; no external link or verified timestamp is invented. A comparison describes trade-offs, not a universally best choice.” |
| 1:20–1:50 | Add choices individually. For Designing your career story, complete the demo name/attendance confirmation. | No automatic additions or RSVPs. Cancel the form once if time permits, then approve. Show calendar changes. The current fixture suggests creative coding, a career workshop and an international tea table; if data/config changes, use the current displayed records. |
| 1:50–2:20 | Simulate cancellation → Suggest replacement. | Show the affected title and the two retained choices. The cancelled record is removed; the alternative remains a draft. Original constraints remain strict. If no match exists, explicitly choose which filter to change instead of quietly relaxing it. |
| 2:20–2:45 | Review replacement evidence and RSVP status; explicitly add/approve it. Export final calendar. | “The new selection is rechecked against the latest plan. The ICS export uses the configured demo week and time zone, and excludes cancellations. It does not connect an external account.” |
| 2:45–3:00 | Point to evaluation documentation; optionally show Restore previous demo. | “Twenty synthetic scenarios compare search, rules and context planning. Live watsonx: Not yet evaluated. Real student usefulness and organizer trust still need research.” |

Optional follow-up outside the three minutes: Settings → Team tools → Open synthetic-data review. Filter Unknown eligibility or Missing original URL. Missing external sources are expected for fictional records. The review is read-only; corrections go through a source-controlled team review and validation.

Preparing again resets only the guided state; the original browser-local state is archived once until Restore previous demo. Configuration changes create separate storage namespaces. Do not clear browser storage unless deliberately discarding that local archive.

## Synthetic update loop (optional extension)

After the main demonstration, show the update loop:

| Step | Action | Say / show |
|---|---|---|
| 1 | Click the **bell** icon (topbar), **Check for updates** in Settings › Notifications, or the AI Planner's Event updates panel | "This applies the next pre-scripted batch of fictional catalog changes. Nothing is fetched from a server; everything is local." |
| 2 | Read the "What changed since your last check" feed | "Batch 1: a Career event was cancelled and a Social dinner is now full. Events in your plan are highlighted." |
| 3 | Click again for Batch 2 | "The AI lab time moved to an earlier slot — now it may conflict with another event. The room for Graduate makers night changed." |
| 4 | Click again for Batch 3 | Point to the "Needs confirmation" badge on the AI open studio card. "Two conflicting notices arrived for the same event — one says cancelled, one says the room changed. We do not choose which is correct; it shows 'Needs confirmation' until the student verifies directly." |
| 5 | Try to add or plan a cancelled/full event | "The backend rejects the attempt because the applied update IDs travel with every plan and validate request." |

Each event card shows its **Last checked** relative time from the catalog. Event detail panels show the full update notice and the "Needs confirmation" warning without picking either notice as authoritative.
