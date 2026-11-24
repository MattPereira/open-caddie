---
status: accepted
date: 2026-11-23
---

# Each preview gets its own Neon branch from Neon's Vercel integration

Supersedes ADR 0009's shared `staging` branch. The Neon project (`broad-bonus-57400925`) stays in our own Neon organization. Neon's **Neon-Managed** Vercel integration ("Link Existing Neon Account") links it to the Vercel project:

- **Preview:** for each preview deployment, the integration creates a `preview/<git-branch>` Neon branch from `production` and injects that branch's `DATABASE_URL` / `DATABASE_URL_UNPOOLED`. The preview build migrates its own branch (ADR 0006).
- **Development:** Vercel's Development env vars point at a `vercel-dev` branch, which the integration created. Local dev pulls them with `vercel env pull .env.local`.
- **Production:** plain Vercel env vars point at the `production` branch. The integration doesn't touch them.
- **Cleanup:** "Automatically delete obsolete Neon branches" deletes a preview branch when its Git branch is merged or deleted.

This is a different integration from the **Vercel-Managed** one ("Create New Neon Account") that ADR 0009 moved off. That one puts the Neon project in a Vercel-owned organization, and it deletes branches only when their deployment is deleted.

## Considered Options

- **Keep the shared `staging` branch (ADR 0009).** Rejected: a PR that adds a migration gets a preview that runs new code on the old schema, and every preview shares the same data.
- **A Neon branch per PR, created by GitHub Actions (#244).** Rejected: it needs a `VERCEL_TOKEN` in GitHub, its own deploy step and a cleanup workflow. The integration does all of that.

## Consequences

- A PR's preview shows its schema changes. CI's `Rehearse prod migrations` is still the pre-merge check, because a preview branch is copied once and wouldn't re-test an edited migration (ADR 0006).
- Each preview branch starts as a copy of prod data.
- If the integration hasn't injected the branch's URLs, a preview build sees no `DATABASE_URL_UNPOOLED` and fails, or sees prod's and the endpoint guard refuses it. On #94 the old integration's provisioning timed out before builds started. If that comes back, #244 is the fallback.
- One Neon branch per pushed Git branch counts against Neon branch limits, and each preview build wakes a compute (ADR 0005).
- `vercel-dev` drifts from prod. Reset it from its parent in Neon when needed.
