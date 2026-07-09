# Issue tracker: GitHub

Issues and PRDs live as GitHub issues. Use `gh` for all operations.

## Conventions

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

Infer the repository from `git remote`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

Do not include PRs in `/triage`.

## Publishing and fetching

When a skill says “publish to the issue tracker,” create a GitHub issue.

When a skill says “fetch the relevant ticket,” run `gh issue view <number> --comments`.

## Wayfinding operations

- Map: issue labelled `wayfinder:map`.
- Child: GitHub sub-issue; fall back to a task-list link when unavailable.
- Blocking: native issue dependencies; fall back to `Blocked by: #<n>`.
- Claim: `gh issue edit <n> --add-assignee @me`.
- Resolve: comment with the answer, then close.
