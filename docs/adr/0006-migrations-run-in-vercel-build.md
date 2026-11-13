---
status: accepted
date: 2026-11-09
---

# Migrations run in the Vercel build

Every Vercel deployment runs `scripts/vercel-migrate.sh` before `next build` (`vercel.json` `buildCommand`). The script migrates that deployment's Neon branch over `DATABASE_URL_UNPOOLED`, and refuses to touch prod from a non-production build. The unpooled URL is passed in by the script rather than as a fallback in `drizzle.config.ts`: that file also loads `.env.local`, whose Neon `DATABASE_URL_UNPOOLED` would win over a `DATABASE_URL` set for any other database and migrate Neon instead. Which branch each deployment migrates: production migrates the Neon `main` branch, and each preview migrates its `preview/<git-branch>` branch. Before this, nothing applied migrations automatically: prod was migrated by hand and previews ran new code against the schema copied from prod. A separate CI job is the merge gate: on PRs touching migrations it migrates a fresh Neon branch of prod, because a preview branch is copied from prod only once and drizzle skips migrations it has already recorded, so editing a migration between pushes would not re-test it.

## Considered Options

- **GitHub Actions migrates prod on push to `main`, then runs `vercel deploy --prod`** (with Vercel's git auto-deploy disabled for `main`). This gives explicit ordering and logs in GitHub. It was rejected because it needs `VERCEL_TOKEN` and a prod database URL in GitHub secrets, and it replaces Vercel's git deploy flow, all to order two steps the build already runs in sequence.
- **Use the preview branch's migration as the merge gate.** Rejected for the staleness reason above.

## Consequences

- **Migrations must be backward-compatible with the code currently deployed.** The schema changes before the new code is live, and if the build fails after migrating, the old code keeps serving on the new schema. Renames and drops take two PRs: first add the new column or table, then remove the old one once nothing reads it.
- **No lock against concurrent migrations.** Two production builds in quick succession could both run `db:migrate`. drizzle applies all pending migrations in one transaction and records each one, so a double apply fails loudly instead of corrupting data. That is accepted for a single-maintainer project. Add `pg_advisory_lock` or serialise production builds if this ever bites.
- Each deploy wakes the target branch's compute briefly (see ADR 0005). Previews with no pending migrations still connect once.
