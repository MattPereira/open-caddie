# Handoff — Candidate B: give `lib/handicap` the Playing Handicap it's missing

Deferred deepening opportunity surfaced by an architecture review on 2026-07-21.
Full context + before/after diagrams: `/tmp/architecture-review-20260721-173806.html`
(candidate B). This doc captures only what that report and the codebase don't.

## Why this exists

`assessHandicap` (`lib/handicap/index.ts:90`) is a deep, tested module — but it stops
at **Course Handicap**. **Playing Handicap** — a first-class term in `CONTEXT.md`
("Match scoring" / "Handicap" sections), defined as the Course Handicap actually
applied, with a Player Index Override's Course Handicap taking precedence over a
computed one — has **no home in the module**. Every query caller reconstructs the
resolution by hand.

## The friction (file:line)

- `lib/handicap/index.ts` — `assessHandicap` returns `{ playerIndex, courseHandicap,
  netStrokes, usedDifferentialIndexes }`. No `playingHandicap`.
- `lib/rounds/queries.ts:216-240` — calls `assessHandicap` **twice** (computed +
  override), then hand-codes the precedence: `const playingHandicap = matchHandicap ??
  courseHandicap;`, plus the null-when-no-club / null-when-no-match rules.
- `lib/matches/queries.ts:224` — override-only path; renames `courseHandicap` →
  `playingHandicap` in the projection.
- `lib/tournaments/queries.ts:229-241` — computed-only path; same rename.
- `lib/clubs/standings/queries.ts:293` — computed; keeps all three fields.
- **Recency window double-implemented:** `lib/clubs/standings/queries.ts:285-292`
  sorts rounds by date and `.slice(0, 4)` *before* calling `assessHandicap`, which
  then applies `roundLimit = 4` again (`lib/handicap/index.ts:29`,
  `selectPlayerIndexDifferentials`). "Last 4" lives half in the caller, half in the
  module.

## Proposed deepening

Resolve and return `playingHandicap` from `assessHandicap` (or a sibling entry), so
the override-takes-precedence rule and the null-when-no-club/match rules live inside
the module. Own the recency window fully — callers stop pre-sorting/slicing. Callers
then read `playingHandicap` instead of re-deriving it.

## Open question to grill before touching it

The two one-liner primitives `calculateCourseHandicap` / `calculateNetStrokes`
(`lib/handicap/index.ts:3,8`) are called **live in React**:
- `app/(app)/rounds/[id]/play/_components/round-score-state.ts:53` — `calculateNetStrokes`
- `app/(app)/rounds/[id]/_components/round-scores-sheet.tsx:180-185` — derives
  `playerIndex` then `calculateCourseHandicap` inline (per-keystroke recompute).

This may be a **real second adapter** (live editing can't easily assemble an
`AssessHandicapInput`). Per the "one adapter = hypothetical seam, two = real" rule,
decide deliberately whether that path folds into `assessHandicap` or keeps a thin
primitive — don't just hide it.

## Out of scope (noted, separate seam)

Score Differential formula and the `113` slope constant are duplicated across the
lib↔SQL seam: TS in `lib/handicap/index.ts:1,5` vs the SQL view in `db/schema.ts:442`
(and migration `db/migrations/0011_aromatic_talos.sql`). Not part of candidate B;
flag if revisited.

## Domain terms in play

See `CONTEXT.md`: **Player Index**, **Player Index Override**, **Course Handicap**,
**Playing Handicap**, **Score Differential**. If the deepened entry introduces a name
not in `CONTEXT.md`, add it there.

## Suggested skills

- `/grilling` — walk the decision tree: where the seam sits, whether the live-form
  primitives are a real second adapter, what tests survive.
- `/codebase-design` — design the deepened interface (the `assessHandicap` return
  shape / a `resolvePlayingHandicap` entry); use design-it-twice if the interface is
  contested.
- `/domain-modeling` — if the interface names a concept not yet in `CONTEXT.md`, or
  sharpens Playing Handicap's definition.
- `/tdd` — `lib/handicap` already has `index.test.ts`; extend it to cover Playing
  Handicap resolution before/while changing callers.
