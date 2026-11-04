# Final proposal alignment audit

Audit baseline: Doris `811dc1e`. Original proposal document was not available in the workspace; alignment uses the user's final pasted requirements. Assumptions about first-semester graduate students and cross-disciplinary discovery are requirements, not validated research findings.

Already functional before this iteration: local onboarding/preferences, Rust recommendation evidence, fictional provenance, community search/details/membership, weekly briefing, strict replacement suggestions, explicit demo RSVP, calendar export, modular enrollment/conversation/interpretation, stale-response rejection and browser fallback. These features are retained rather than recreated.

Gaps identified before implementation: no reproducible baseline evaluation; ranking can cluster one topic; date/campus assumptions scattered; missing clarification for ambiguous requests; no separate data-review workflow or compact reproducible demonstration launcher. Free-text major/goals are stored, not interpreted. No live model or externally verified sources exist.

Evaluation expectations are frozen in `evaluation/scenarios.json` before ranking changes: 12 development and 8 held-out cases. Held-out cases are not used to choose ranking weights. Because this is a small hand-authored synthetic suite and developers can see all cases, it is a regression/feasibility evaluation, not a blinded generalization benchmark.

## Final requirement checklist

| Proposal / prompt requirement | Status | Evidence / remaining boundary |
|---|---|---|
| Fictional first-semester student onboarding and topic/time preferences | Implemented | Existing Profile/onboarding retained; guided profile exposes context and busy classes |
| Relevant, feasible weekly recommendations | Implemented | Rust filtering, diversity-aware selection, validated constraints and API parity tests |
| Cross-disciplinary exploration | Partially implemented | Multiple topics/categories and explicit open synthetic access; no verified academic-department metadata or real membership decisions |
| Goal/major personalization | Partially implemented | Topic selections/preferred times influence ranking; free-text major and goals do not and are disclosed as uninterpreted |
| Comparison, uncertainty and explanation evidence | Implemented | Catalog-derived practical evidence, comparison, structured satisfied filters, remaining requirements and scenario checks |
| Ambiguity/unsupported/no-match distinctions | Partially implemented | Bounded deterministic clarification patterns (location, weekday negation, cost ambiguity, AM/PM), unsupported guidance and Rust no-match counts; not general natural-language understanding |
| Evaluation vs ordinary discovery | Implemented | 20 checksum-frozen cases, 12 development / 8 held-out; A search, B rules, C actual Rust; raw results and reproducible report |
| Proof of live-AI benefit | Not implemented | Live IBM watsonx model-dependent results: Not yet evaluated; no such claims made |
| Central campus/week/time zone | Implemented | `data/demo.json`, derived labels and UTC export, Rust `/api/config`, configuration/DST/storage tests |
| Real multi-campus tenancy | Not required for the MVP | Configuration selects one fictional demo; no cross-campus live services |
| Event source transparency | Implemented | Unknown fields remain unknown; authoring dates never become external verification |
| Team data-quality review | Implemented | Read-only view via Settings → Team tools; counts/filters; corrections require a reviewed catalog commit and tests |
| Trusted event-data editor | Not implemented | Deliberately read only; no unvalidated browser edits or fake verification controls |
| Three-minute demo launcher | Implemented | Reproducible profile, archived prior state, live progress, explicit cancellation, replacement and export actions |
| Student-approved additions and RSVP | Implemented | Existing enrollment module retained; reset/stale-response and fresh consent checks |
| Cancellation and strict replanning | Implemented | Retained choices unchanged, filters preserved, consent before replacement; browser journey tested |
| Community discovery and local discussions | Implemented | Existing targeted community navigation and independent membership preserved |
| Calendar export | Implemented | Configured IANA-zone-to-UTC conversion; no external calendar sync |
| Desktop/mobile usability | Implemented | Chromium 1280px and 390px full journeys and overflow checks; not a complete accessibility audit |
| Production auth, database, Canvas, live university APIs | Not required for the MVP | Intentionally absent |
| Real student/organizer validation and business outcomes | Not implemented | Research still required; no interviews, feedback or outcomes invented |
| Genuine IBM Bob development evidence | Not implemented | Must be collected separately by the team in real Bob sessions |

## Submission evidence still needed

- Confirm the original proposal text with the team; this audit uses the supplied requirements only.
- Interview/observe first-semester students from more than one discipline with consent: where they discover events, what access/RSVP/food information matters, and whether this flow improves task completion. Measure search time, acceptable choices, clarification burden and scheduling errors against an ordinary search task; do not extrapolate from synthetic cases.
- Ask organizers how eligibility, capacity and source freshness should be represented and corrected. Obtain permission and provenance before replacing fictional records with real ones.
- Have independent reviewers rate explanation usefulness/trust and keyboard/screen-reader usability. Current checklist scores are structural, not human evaluations.
- Record genuine IBM Bob sessions if required by the lab. Verify IBM region/model/access before any watsonx integration, then collect model-specific evaluation separately.
- Confirm mascot asset permission before any broader public distribution, as documented in README.

## Verified delivery evidence

All seven required commands passed on the final implementation: `npm test` (catalog assertions, 49 TypeScript tests, 5 Wiki tests), `npm run build`, `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, `cargo test --locked` (6 tests), `cargo build --locked`, `npm run test:api` (functional API/parity checks). The evaluation executed 60 observations, and two successive runs produced byte-identical report/result files verified by SHA-256. No failed/skipped tests are counted as passes; the main-binary and Rust doc-test targets contain zero tests and are not counted in the six.

The checked-in Chromium journey passed at 1280px and 390px: scenario preparation/cancel/reset, all three manual additions including RSVP, evidence/comparison/details, cancellation with retained choices, explicit replacement approval, ICS download, archive restore, review counts/filters, clarification and seven-view overflow checks. Screenshots were visually inspected for the mobile launcher. Browser automation is a smoke check, not a complete accessibility audit or a measured human three-minute completion study.

Changed areas: Rust interpretation/selection/evidence/API; shared `data/demo.json`; TypeScript configuration/date/ICS/storage helpers; isolated `DataReview`, `quality`, `DemoLauncher`, `demoScenario` modules and existing UI integration; reproducible `evaluation/` runner/fixtures/metrics/results; API, configuration, diversity and scenario regression tests; `scripts/browser-journey.mjs`; README, backend guide, watsonx plan, methodology/report, audit and demo script. Application dependencies and lockfiles are unchanged; Playwright is optional external test tooling.
