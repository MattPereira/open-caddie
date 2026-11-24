---
status: accepted
date: 2026-11-23
---

# Each Vercel build migrates its own Neon branch

Every Vercel build runs `pnpm db:check-migrations` then `pnpm db:migrate` before `next build` (`vercel.json` `buildCommand`), against its environment's branch in the Neon project `broad-bonus-57400925`, which lives in our own Neon organization: Production migrates `production`, and each Preview migrates a `preview/<git-branch>` that Neon's Vercel integration copies from `production` and deletes on merge.

How to work with this: the `database-migrations` skill (`.agents/skills/database-migrations/SKILL.md`).

## Considered Options

- **GitHub Actions migrates prod, then runs `vercel deploy --prod`.** Rejected: it needs `VERCEL_TOKEN` and a prod URL in GitHub, and replaces Vercel's git deploys, all to order two steps the build already runs in sequence.
- **Previews share one long-lived branch.** Rejected: a PR that adds a migration gets a preview running new code on the old schema, and every preview shares the same data.
- **Per-PR branches created by GitHub Actions.** Rejected: it needs `VERCEL_TOKEN`, its own deploy step and a cleanup workflow. The integration does all three.
- **A CI job that rehearses migrations on a fresh copy of prod before merge.** Rejected: a migration that fails on prod rolls back, since drizzle applies all pending migrations in one transaction. The build then stops and the previous deployment keeps serving. A preview has already run the migration against a copy of prod data.
