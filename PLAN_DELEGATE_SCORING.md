# Delegated scoring for match partners

## Context

On the round play page (`/rounds/[id]/play`), a user can currently only record scores for themselves. In a match, it's common for one phone to record scores for the whole group — and some players don't want to use the app at all. We want one player to optionally record scores **for one additional player** in the same match, alongside their own.

Constraints / scope:
- Only available when the round has a `matchId`.
- Up to **one** delegate at a time.
- Player selection lives in the existing **Settings → Scoring** tab (currently a TODO placeholder).
- Writes go through the existing per-hole upsert actions; auth relaxes from "round owner only" to "match participant".
- Realtime visibility is **out of scope** — the delegated player sees their scores when they reload.

## Current state (as of plan creation)

- The play page Settings dialog (`SettingsDialog` in `round-scores-form.tsx`) already exists with three tabs: **Tees**, **Handicap** (matchId-gated), **Scoring** (matchId-gated).
- The **Scoring** tab currently renders only a placeholder paragraph: _"TODO: allow user to select another player in this match to record scores on behalf of"_. Phase 2 replaces this.
- `tees`, `matchId`, `teeId`, etc. are already threaded from `page.tsx` → `RoundPlay` → `RoundScoresForm`. `matchPlayers` is the new prop introduced in Phase 1.
- No `localStorage` hook exists yet — create it in Phase 2.
- All write actions in `actions.ts` still enforce `eq(rounds.userId, session.user.id)` (plus admin override) — Phase 3 relaxes this.
- `PlayScoresOverview` currently takes a single `scores: ScoreEntry[]` + `greenieHoles: Set<number>`. Phase 4 changes the shape.
- `HoleScoreSlide` and `HoleGreenieManager` are already prop-driven (hole + callbacks) — no internal refactor needed before duplicating.

## Locked decisions

| Question | Decision |
|---|---|
| Delegate persistence | `localStorage`, raw via a small custom hook. Migrate to Zustand later once we have more client-side config. |
| Dictation order | "You first, delegate second" — e.g. say `five two four one` for you=5/2, delegate=4/1. UI hint explains this. |
| Realtime sync | Out of scope. Delegate sees their scores on next page load. |
| Score overview | **Modify** `PlayScoresOverview` to accept multiple player score rows (one shared table). Drop greenie hole color tinting for now. |

## Approach (7 incremental phases)

Each phase is independently shippable and reviewable. Order matters — earlier phases unblock later ones.

### Phase 1 — Data plumbing (read-only)

Fetch the other match players' rounds on the play page and thread them to `SettingsDialog`.

- `app/(app)/rounds/[id]/play/page.tsx`: when `round.matchId != null`, call `getMatchById(round.matchId)` (already exists in `db/queries/matches.ts`) and pass a `matchPlayers` array to `RoundPlay`.
- Shape per entry: `{ roundId, userId, firstName, lastName, scores, greenies }` — sourced from `getMatchById().rounds[]`. Exclude the current user.
- Thread through `round-play.tsx` → `round-scores-form.tsx`.
- No UI change yet.

### Phase 2 — `useDelegateRoundId` hook + Settings → Scoring selection

- Add `app/(app)/rounds/[id]/play/_components/use-delegate-round-id.ts`:
  - SSR-safe: reads `null` during SSR/initial render, hydrates from `localStorage` on mount.
  - Key: `opencaddie:delegateRoundId:${roundId}`.
  - Returns `[delegateRoundId, setDelegateRoundId]`. Setting `null` removes the key.
- In `RoundPlay`, call the hook and pass `delegateRoundId` + setter down.
- Replace the TODO placeholder in `SettingsDialog`'s **Scoring** tab:
  - Radio group of `matchPlayers` plus a "None" option (default).
  - Selecting writes via the hook; selection survives a page reload on the same device.

### Phase 3 — Relax server-action auth to match participants

In `app/(app)/rounds/actions.ts`, add a shared helper:

```ts
async function assertCanWriteToRound(session, roundId):
  Promise<{ ok: true; round } | { ok: false; error }>
```

Allow the write if:
- `session.userId === round.userId`, OR
- `session.userId` is `isAdmin`, OR
- `round.matchId != null` AND the session user has their own round in that same `matchId`.

Refactor `upsertRoundScore`, `upsertRoundGreenie`, `deleteRoundGreenie` to use the helper. **Leave `updateRoundScores` alone** — that's settings-level (tees, handicap) and should stay owner-only.

### Phase 4 — Multi-player `PlayScoresOverview`

Modify (do not duplicate) `app/(app)/rounds/[id]/play/_components/play-scores-overview.tsx`.

New prop shape:

```ts
type PlayerRows = {
  label: string;        // "You" or first name
  scores: ScoreEntry[];
};

type PlayScoresOverviewProps = {
  players: PlayerRows[];  // one or two entries
  currentHole: number;
};
```

Internal layout (single shared table):
- One shared hole-header row at top (with current-hole highlight + front/back switch — unchanged).
- For each player: a small name label, then their Strokes row, then their Putts row.
- Shared totals column on the right.
- **Remove the greenie hole color tinting** in the header row (revisit later).
- Update the call site in `RoundScoresForm` to pass `players={[{ label: "You", scores }]}` for solo mode and `[{ label: "You", scores }, { label: delegateName, scores: delegateScores }]` for duo mode.

### Phase 5 — Second strokes/putts input set

In `round-scores-form.tsx`:
- Lift `handleSave` to take a `targetRoundId` parameter; existing optimistic-update / rollback semantics work for both players.
- Track `delegateScores` state in parallel with the existing `scores` state, initialized from `matchPlayers` snapshot.
- Below the current `HoleScoreSlide` inside the carousel slide, render a **second** `HoleScoreSlide` bound to the delegate's hole/values, with its save callback writing to the delegate's `roundId`.
- Add a small player-name label above each `HoleScoreSlide` so it's obvious which inputs are which.

### Phase 6 — Greenie support for delegate

- On par-3 holes, stack two `HoleGreenieManager` instances, each labelled with the player's first name.
- Each manager writes to its own `roundId` via `upsertRoundGreenie` / `deleteRoundGreenie`.
- Add `delegateGreenies` state mirroring the existing `greenies` pattern.

### Phase 7 — Two-player dictation

- Add `parseTwoPlayerScoreDictation(transcript, par)` in `score-dictation.ts`:
  - Returns `{ you: ScoreDictationPatch | null; delegate: ScoreDictationPatch | null } | null`.
  - Convention: first two numbers → you (strokes, putts); next two → delegate (strokes, putts).
  - Keep existing `parseScoreDictation` for single-player mode.
- `ScoreDictationButton` gains a `mode: "single" | "duo"` prop and a duo-mode callback.
- Add a short UI hint near the dictation button when in duo mode: e.g. _"Say four numbers: your strokes, your putts, then theirs."_

## Critical files

- `app/(app)/rounds/[id]/play/page.tsx` — fetch match players (P1)
- `app/(app)/rounds/[id]/play/_components/round-play.tsx` — thread props, lift delegate state (P1, P2)
- `app/(app)/rounds/[id]/play/_components/round-scores-form.tsx` — settings UI, second inputs/greenies (P2, P5, P6)
- `app/(app)/rounds/[id]/play/_components/use-delegate-round-id.ts` — new hook (P2)
- `app/(app)/rounds/[id]/play/_components/play-scores-overview.tsx` — multi-player prop shape (P4)
- `app/(app)/rounds/actions.ts` — auth helper + refactor (P3)
- `app/(app)/rounds/[id]/play/_components/score-dictation.ts` — duo parser (P7)
- `app/(app)/rounds/[id]/play/_components/score-dictation-button.tsx` — mode prop + UI hint (P7)
- `db/queries/matches.ts` — already returns what's needed; no changes expected (verify in P1)

## Reusable utilities found during exploration

- `getMatchById` — `db/queries/matches.ts` — returns `rounds[]` with `id, userId, firstName, lastName, scores, greenies`. Reuse as-is.
- `upsertRoundScore`, `upsertRoundGreenie`, `deleteRoundGreenie` — `app/(app)/rounds/actions.ts` — already accept `roundId`; only the auth guard relaxes.
- `HoleScoreSlide`, `HoleGreenieManager` — already prop-driven, no internal coupling to "current user's round" — render a second instance with different `roundId` callbacks.
- `parseScoreDictation` — `score-dictation.ts` — keep for single-player; add a duo variant alongside.

## Verification

End-of-each-phase smoke check:

- **P1** — Open play page for a match round; `matchPlayers` prop populated (React Devtools). Non-match round renders unchanged. `pnpm run check` passes.
- **P2** — Settings → Scoring lists the other match players; selecting one writes the `localStorage` key; reload restores selection; "None" clears it.
- **P3** — With a delegate selected, manually call `upsertRoundScore` for the delegate's `roundId` from devtools — succeeds. Sanity: a user not in the match still gets rejected.
- **P4** — Multi-player overview renders correctly in both solo (one player) and duo (two players) modes. Front/back nine switch toggles both. Solo mode visually unchanged from today (aside from removed greenie tinting).
- **P5** — Entering strokes/putts in the delegate's row saves to their round. Verify on the delegate's own play page after reload.
- **P6** — On a par-3 hole, both greenie managers visible and editable independently.
- **P7** — Holding dictation in duo mode, say "five two four one" → both rows update. Single mode parses single-player phrases unchanged.

**Final end-to-end:** as user A in a match, select user B as delegate in Settings → Scoring, walk through 18 holes via voice + manual entry, then log in as user B and verify all scores landed on their round. Tournament-only round still shows no Scoring tab.
