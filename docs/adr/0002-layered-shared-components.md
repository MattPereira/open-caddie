---
status: accepted
date: 2026-07-13
---

# Layered shared-component folders

Route-specific components colocate in each route's `_components/` folder; `components/` at the root holds only components shared by two or more routes. That shared bucket is organised by architectural **layer**, not by domain or by kind:

- `components/ui/` — generated shadcn primitives (unchanged).
- `components/layout/` — global app shell and page scaffolding (sidebar, wordmark, theme, `page-heading`, `page-content`).
- `components/shared/` — hand-written generic primitives composed on top of `ui/` (`media-card`, `card-grid`, `responsive-table`, `stat-tile`, overlays, inputs). App-agnostic; no golf concepts.
- `components/domain/` — golf-aware but presentational, cross-domain components: the entity `*-card` family, `course-hero`, `play-round-button`.
- `components/features/<cluster>/` — multi-route workflow clusters (`scorecard-import`, `scores`, `standings`).

The `*-card` family stays in `components/domain/` regardless of current usage count, so the family is never split across `_components/` and the root.

## Considered options

- **By domain** (`clubs/`, `courses/`, `rounds/`…) was rejected because the usage data showed most shared components are cross-domain — a `winner-card` used in four domains, `card-grid` in six — so they have no single domain home, and by-domain grouping forced arbitrary placement plus several one-file folders.
- **By kind** (`cards/`, `tables/`, `buttons/`) was rejected because it fragments a feature's pieces across folders (a scorecard-import form, button, and overlay would live in three places) — the classic flat-bucket smell the reorg set out to fix.
- The layered split was chosen because it matches the actual shape of the code: a spine of cross-domain primitives plus a few tight workflow clusters. "Where does this go?" becomes a layer lookup rather than a judgment call.

## Consequences

Every new shared component must be placed by layer, and single-route components must go to a route's `_components/` rather than the root. Two non-components were extracted while drawing the boundaries: `displayName`/`getInitials`/`PlayerCardPlayer` moved out of `player-card.tsx` into `lib/players/player-name.ts` (a shared util no longer reached out of a component), and `round-scores-card-row.ts` (types + logic, not a component) was renamed to `features/scores/round-scores.ts`.

The card family being a single legible folder is a deliberate setup for a possible later refactor toward a generic configurable card — but that is a separate, semantic change; this decision is purely about placement.
