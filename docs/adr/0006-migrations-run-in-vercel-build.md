---
status: accepted
date: 2026-11-09
---

# Migrations run in the Vercel build

Every Vercel build runs `scripts/vercel-migrate.sh` before `next build` (`vercel.json` `buildCommand`). Each build migrates its own database over `DATABASE_URL_UNPOOLED`. Production builds migrate prod, and preview builds migrate the `preview/<git-branch>` Neon branch that the integration injects (ADR 0010). A non-production build whose host is prod's endpoint is refused, so a misconfigured preview can't migrate prod. The unpooled URL is passed in by the script rather than as a fallback in `drizzle.config.ts`: that file also loads `.env.local`, whose Neon `DATABASE_URL_UNPOOLED` would win over a `DATABASE_URL` set for any other database and migrate Neon instead. Before this, nothing applied migrations automatically: prod was migrated by hand. A separate CI job (`Rehearse prod migrations`) tests migrations before merge: on PRs touching migrations it migrates a fresh Neon branch of prod, so an edited migration is re-tested on every push.

## Considered Options

- **GitHub Actions migrates prod on push to `main`, then runs `vercel deploy --prod`** (with Vercel's git auto-deploy disabled for `main`). This gives explicit ordering and logs in GitHub. It was rejected because it needs `VERCEL_TOKEN` and a prod database URL in GitHub secrets, and it replaces Vercel's git deploy flow, all to order two steps the build already runs in sequence.
- **Use a per-preview Neon branch's migration as the pre-merge check.** Rejected: a preview branch is copied from prod only once and drizzle skips migrations it has already recorded, so editing a migration between pushes would not re-test it. Previews still migrate their own branch (ADR 0010), but that is not the pre-merge check.

## Consequences

- **Migrations must be backward-compatible with the code currently deployed.** The schema changes before the new code is live, and if the build fails after migrating, the old code keeps serving on the new schema. Renames and drops take two PRs: first add the new column or table, then remove the old one once nothing reads it.
- **No lock against concurrent migrations.** Two production builds in quick succession could both run `db:migrate`. drizzle applies all pending migrations in one transaction and records each one, so a double apply fails loudly instead of corrupting data. That is accepted for a single-maintainer project. Add `pg_advisory_lock` or serialise production builds if this ever bites.
- Each production deploy wakes the prod compute briefly (see ADR 0005), even with no pending migrations.

## Amendments

Previews originally migrated their own `preview/<git-branch>` Neon branch, created by the Neon–Vercel integration, and the script refused to migrate prod's endpoint from a non-production build. The integration was then dropped (ADR 0009): previews shared a `staging` branch and didn't migrate, so the guard went too. ADR 0010 brought per-preview branches back through Neon's Neon-Managed integration, and the endpoint guard with them. The decision above reflects the current behaviour.
