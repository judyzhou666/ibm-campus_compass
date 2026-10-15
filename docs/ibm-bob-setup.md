# Continue Campus Compass in IBM Bob

Reference: [IBM Bob: Start a project with /init and AGENTS.md](https://bob.ibm.com/docs/ide/tutorials/start-a-project), consulted October 15, 2026.

Open this repository's root in Bob IDE. Select Agent mode in Bob's chat and run `/init`. IBM describes this as a project scan that creates persistent context in root `AGENTS.md` and mode-specific files under `.bob/`. Review Bob's proposed changes against our existing instructions, preserving the Rust backend, React/TypeScript frontend, `docs/` convention, and clearly simulated demo boundaries.

The guide lists these mode-specific paths:

- `.bob/rules-code/AGENTS-code.md`
- `.bob/rules-plan/AGENTS-plan.md`
- `.bob/rules-ask/AGENTS-ask.md`

Re-run `/init` after major directory, framework, or service changes, and review the resulting context before committing it. This refactor is a suitable time to do so. The `.bob/` files should come from your actual Bob session; this repository does not pretend they were generated here.

## Suggested first task for your team

Ask Bob to trace an AI Planner request from `frontend/src/api.ts` through `backend/src/lib.rs`, explain where the fictional event catalog is validated, and run the commands in `docs/backend.md`. Then ask it to add a small regression case for a scheduling constraint your team chooses. Review its changes and record the prompt, relevant diff, test results and reviewer in `docs/`.

This guide is a handoff for future Bob work. It is not evidence that Bob has already implemented or tested this project. Live IBM watsonx integration remains deferred until the account configuration and API contract are verified.
