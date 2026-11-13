---
status: accepted
date: 2026-11-13
---

# Domain code moves into enforced modules under `src/modules/<name>`

Domain logic lived in `lib/<domain>` folders where any file could import any other, so nothing separated a domain's interface from its implementation. Callers reached into internals, refactors spread, and agents couldn't tell which imports were allowed. Domain code now moves into `src/modules/<name>`. A module's root files are its entry points, everything in its subfolders is private, and dependency-cruiser (`.dependency-cruiser.cjs`, `pnpm lint:boundaries`, run in `check` and CI) fails any import that bypasses the entry points. Tests go through the entry points too, even for their own module.

`lib/<domain>` migrates one slice at a time. Season Standings is the first (`src/modules/season-standings`), with a server entry point (`index.ts`) and a client-safe one (`point-rules.ts`). Until a domain migrates, modules may import from `lib/` freely. The convention and rules are in [`src/modules/README.md`](../../src/modules/README.md).

## Considered Options

- **`src/packages`** (the skill's default). Rejected: "packages" collides with pnpm workspace packages.
- **`src/app/modules` or `src/app/_modules`.** Rejected: `src/app` is the Next.js router, where every folder is a route segment unless opted out with `_`. Domain code doesn't belong in the router.
- **Convention without enforcement** (a README and review). Rejected: the problem is that nothing stops a deep import today. An agent follows a failing check more reliably than a paragraph.

## Consequences

- Reads keep the [ADR 0003](./0003-data-access-placement.md) rules inside a module. They sit behind the module's entry points, stay `cache()`-wrapped, and are imported directly into Server Components. Writes still enter through a route's `actions.ts`.
- A module's entry point may import the db (no DB injection). DB-backed tests keep per-worker databases ([ADR 0008](./0008-per-worker-test-databases.md)).
- Layering (which modules may depend on which) and whether a module owns its UI are deferred until more modules exist.
