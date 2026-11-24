---
status: accepted
date: 2026-11-23
---

# Neon is managed outside Vercel; previews share a staging branch

The database moves from a Vercel-managed Neon project, wired up by the Neon–Vercel integration, to an independently managed Neon project (#96). Vercel keeps hosting the app. Connection strings are set as plain Vercel env vars: production's point at the Neon `main` branch, and the Preview environment's point at one long-lived `staging` Neon branch that every preview deployment shares. Previews never migrate it (ADR 0006).

The integration created a `preview/<git-branch>` Neon branch for every preview and injected its URLs into the build. On PR #94 that provisioning repeatedly timed out before the Vercel build started, though the branch itself was ready; the integration handshake is the suspected cause. Neon can't transfer a project out of a Vercel-managed organization, so the move is a new project plus a data copy.

## Considered Options

- **Keep the integration and retry provisioning.** Rejected: the failure is in a handshake we don't control, and it blocks builds.
- **A Neon branch per PR, created by GitHub Actions** and passed to the Vercel preview. Deferred: it isolates each PR and lets previews show schema changes, but it needs a `VERCEL_TOKEN` in GitHub, a cleanup workflow, and its own deploy step. Tracked in #244.
- **No database for previews.** Rejected: previews of non-schema changes are useful to click around.
- **Previews migrate staging.** Rejected: migrations from one PR would change the schema under every other open preview, and a closed PR's migration would stay behind.

## Consequences

- A PR that adds a migration has a preview running new code on the old schema; it may break. Its migration is still checked before merge by CI's `Rehearse prod migrations` job, and it can be exercised locally.
- All previews read and write the same staging data.
- Staging drifts from prod as migrations land on `main`. Reset it from its parent in Neon when it does.
- No per-PR Neon branches exist, so there is nothing to clean up when a PR closes.
