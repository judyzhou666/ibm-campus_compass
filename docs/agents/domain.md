# Domain docs

This repo uses a single-context domain documentation layout.

## Before exploring

- Read `docs/GLOSSARY.md` for domain vocabulary, when present.
- Read decisions in `docs/adr/` relevant to the area being explored.

If these documents are absent, proceed silently. Create them lazily
through the domain-modeling skill when terms or decisions are resolved.

## Layout

- `docs/GLOSSARY.md`: shared domain terminology.
- `docs/adr/NNNN-short-title.md`: architecture decision records.

Keep domain documentation in `docs/` to follow the repository's
documentation convention.

## Use the glossary's vocabulary

Use defined terms in issue titles, proposals, hypotheses, and test names.
For missing concepts, reconsider the terminology or note the gap for
domain-modeling.

## Surface ADR conflicts

If a proposal contradicts an existing ADR, identify that ADR and explain
why the decision should be reconsidered.
