# Getting started

## Run the demo locally

```sh
git clone git@github.com:judyzhou666/ibm-campus_compass.git
cd ibm-campus_compass
npm ci
npm run build
cargo run --locked
```

Install Rust stable and Node.js 22.12+ first. Open [the local demo](http://127.0.0.1:4173). Use the HTTP server rather than opening `index.html` directly.

## Demonstration walkthrough

1. Reset the demo in Settings.
2. Open AI Planner and select “AI and education on Tuesday or Thursday afternoons.”
3. Click the top-right **My calendar** button to see your schedule beside the chat. Each new recommendation includes **View details** and **Add to calendar**.
4. Add “Learning with AI: a hands-on lab.” Complete the required demo RSVP with a demo name and attendance confirmation. Cancelling leaves the calendar unchanged; completing the form adds the event immediately. Drop-in events do not need this form.
5. Close the side calendar to show the draft panel, then simulate an event cancellation and ask for a replacement.
6. Try the social/free-food example or export the calendar.

The fixed demonstration week is October 19–23, 2026, in Eastern Time. No Google Calendar or Canvas connection is required. Calendar additions do not submit real RSVPs.

## Tests and limitations

Run `npm test` to check the deterministic matching engine, API fallback and Wiki publisher. See [backend setup and tests](https://github.com/judyzhou666/ibm-campus_compass/blob/main/docs/backend.md) and [IBM Bob initialization](https://github.com/judyzhou666/ibm-campus_compass/blob/main/docs/ibm-bob-setup.md). The current planner uses rules and template responses, so it does not understand arbitrary natural language. IBM Bob development contributions and live watsonx integration must be performed and documented separately.

See the repository's [README](https://github.com/judyzhou666/ibm-campus_compass/blob/main/README.md) for the full walkthrough and data register.
