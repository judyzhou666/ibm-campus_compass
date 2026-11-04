# Issue tracker: GitHub

Issues and specs live in GitHub Issues for
`judyzhou666/ibm-campus_compass`. Use the `gh` CLI from this clone.

## Conventions

- Create: `gh issue create --title "..." --body-file <file>`
- Read with comments and labels:
  `gh issue view <number> --json number,title,body,labels,comments`
- List: `gh issue list --state open --json number,title,labels`
- Comment: `gh issue comment <number> --body-file <file>`
- Apply labels: `gh issue edit <number> --add-label "..."`
- Remove labels: `gh issue edit <number> --remove-label "..."`
- Close: `gh issue close <number>`

Write multiline bodies to a temporary file and pass `--body-file`.
Read `docs/agents/triage-labels.md` when selecting triage labels.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Skill instructions

When a skill says "publish to the issue tracker", create a GitHub issue.
When it says "fetch the relevant ticket", read the issue with its
comments and labels.
