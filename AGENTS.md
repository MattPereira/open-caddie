## Agent skills

### Issue tracker

Issues use GitHub; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage labels use their default names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout. See `docs/agents/domain.md`.

### Coding standards

Follow [CODING_STANDARDS.md](./CODING_STANDARDS.md).

### Modules

Domain code is moving into deep modules: see [src/modules/README.md](./src/modules/README.md) before adding or importing one. `pnpm lint:boundaries` enforces it.

## Verification checks

Do these checks in this order before you report a change to `src/` as complete:

1. `pnpm typecheck`
2. `pnpm lint:boundaries`
3. `pnpm test`
4. `pnpm test:mutation <changed-files>`

Or run the first three with `pnpm check`.

`pnpm lint` lints the whole repository with oxlint (`.oxlintrc.json`).

### About agent-browser

agent-browser lets you drive a real browser through the app from the
terminal: open a page, click, and read the DOM back. Use it to check a change
that `typecheck` and `test` cannot see, and to answer a question about the
page yourself rather than asking the person you are working for. See
`docs/agents/agent-browser.md`.
