---
status: accepted
date: 2026-11-23
---

# Each Vercel build migrates its own Neon branch

Every Vercel build runs `pnpm db:migrate` before `next build` (`vercel.json` `buildCommand`), against the Neon branch that environment uses:

- **Production** migrates the `production` branch. Its `DATABASE_URL` / `DATABASE_URL_UNPOOLED` are set by hand and scoped to Production only.
- **Preview** migrates its own `preview/<git-branch>` branch. Neon's Neon-Managed Vercel integration creates it from `production` on the Git branch's first deploy, injects its URLs into that deployment, and deletes it once the Git branch is merged or deleted.
- **Development** has a `vercel-dev` branch for local work. Builds never migrate it.

The Neon project (`broad-bonus-57400925`) lives in our own Neon organization, not a Vercel-owned one.

The build command passes `DATABASE_URL_UNPOOLED` in as `DATABASE_URL`, because drizzle-kit can fail over the pooler. It isn't a fallback in `drizzle.config.ts`, because that file also loads `.env.local`, whose `DATABASE_URL_UNPOOLED` would win and migrate the wrong database.

## Considered Options

- **GitHub Actions migrates prod, then runs `vercel deploy --prod`.** Rejected: it needs `VERCEL_TOKEN` and a prod URL in GitHub, and replaces Vercel's git deploys, all to order two steps the build already runs in sequence.
- **Previews share one long-lived branch.** Rejected: a PR that adds a migration gets a preview running new code on the old schema, and every preview shares the same data.
- **Per-PR branches created by GitHub Actions.** Rejected: it needs `VERCEL_TOKEN`, its own deploy step and a cleanup workflow. The integration does all three.
- **A CI job that rehearses migrations on a fresh copy of prod before merge.** Rejected: a migration that fails on prod rolls back, since drizzle applies all pending migrations in one transaction. The build then stops and the previous deployment keeps serving. A preview has already run the migration against a copy of prod data.

## Consequences

- **Migrations must work with the code that's already deployed.** The schema changes before the new code is live, and if `next build` fails after migrating, the old code keeps serving on the new schema. Renames and drops take two PRs.
- **Only scoping protects prod.** Prod's URLs must stay scoped to Production. Nothing else stops a preview build from migrating prod.
- **A preview branch is copied once and reused on later pushes.** Drizzle skips a migration it has already recorded, even if the file has changed. If you edit a migration after pushing it, reset `preview/<git-branch>` from `production` in Neon and redeploy.
- **No lock against concurrent migrations.** Two production builds close together could both run `db:migrate`. The second fails loudly instead of corrupting data. Add `pg_advisory_lock` if this ever matters.
- **If the integration doesn't inject a preview's URLs, that preview build fails.**
- **Each build wakes a compute (ADR 0005).** Each preview branch has its own compute, and those count against Neon's limit on concurrently active computes.
- **`vercel-dev` falls behind prod.** Reset it from `production` in Neon when needed.
