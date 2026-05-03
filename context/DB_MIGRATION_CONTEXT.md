# DB Migration: contra-costa-golf-club → open-caddie

Reference for `scripts/migrate-from-ccgc.ts`. Source schema: `contra-costa-golf-club/database/schema.pgsql`. Target schema: `open-caddie/db/schema.ts`.

## Schema diff

| Old | New | Key changes |
|---|---|---|
| `users` | `user` | PK `username` → `id` (UUID). `username` retained as unique. `password` dropped (Auth.js). Added `name` (synthesized as "First Last"), `image`, `emailVerified` (null on import). |
| — | **`clubs`** *(new)* | `handle` PK, `name`, `logo`, `point_rules` jsonb. Multi-tenancy primitive. |
| `courses`, `pars`, `handicaps` | same | Unchanged shape, global (not club-scoped). |
| `tournaments` | `tournaments` | PK `date` → `id` (serial). Added `club_handle` FK (notNull). Partial unique index on `(club_handle, date) WHERE club_handle <> 'casual'`. |
| `rounds` | `rounds` | Stripped to `id`/`tournament_id`/`user_id`. Calc columns dropped (derived on read). FKs translated. |
| `strokes`, `putts`, `greenies` | same | Unchanged shape. |
| `points` | — | Dropped. Computed at read time using each club's `point_rules`. |

## CCGC `point_rules` jsonb (seeded for `ccgc` club)

```json
{
  "participation": 3, "pars": 1, "birdies": 2, "eagles": 4, "aces": 10,
  "strokes":  { "positions": [25, 20, 15, 10, 5] },
  "putts":    { "positions": [6, 4, 2] },
  "greenies": { "tiers": [
    { "maxFt": 2, "pts": 4 }, { "maxFt": 10, "pts": 3 },
    { "maxFt": 20, "pts": 2 }, { "maxFt": null, "pts": 1 }
  ]}
}
```

## Insertion order (FK-dependent)

1. `clubs` — seed `ccgc` (with point_rules) + `casual` (empty)
2. `user` — generate UUIDs, build `username → id` map
3. `courses`, `pars`, `handicaps` — straight copy (with dedup, see below)
4. `tournaments` — insert with `club_handle: 'ccgc'`, capture serial `id`, build `date → id` map
5. `rounds` — preserve legacy `id` by passing it explicitly in `INSERT` (serial accepts override; sequence is reset after via `setval`)
6. `strokes`, `putts`, `greenies` — straight copy with dedup

## Known data quirks (handled in script)

- **Duplicate rows in `pars`, `handicaps`, `strokes`, `putts`** — 10 courses and 142 rounds have exactly 2 identical rows each from a legacy edit bug (INSERT used where UPDATE was needed). Deduped via `SELECT DISTINCT ON (...)` on read.
- **Email duplicates** — fixed manually in local `ccgc` before migration. New schema has `unique` on `email`.

## Run

### Prerequisites

- Local `ccgc` Postgres restored from prod dump (`make populate-local-db` in legacy repo)
- `.env.local` contains:
  - `DATABASE_URL=...neon...?sslmode=require` (open-caddie target)
  - `CCGC_DATABASE_URL=postgresql:///ccgc` (local source)
- `pnpm add -D pg @types/pg` (already installed)

### Command

```bash
pnpm tsx scripts/migrate-from-ccgc.ts
```

### Expected final row counts

```
clubs=2, users=33, courses=21, pars=21, handicaps=21,
tournaments=55, rounds=620, strokes=620, putts=620, greenies=603
```

### Idempotency

`TRUNCATE ... RESTART IDENTITY CASCADE` runs at the top of every execution. Rerun freely.

## Gotchas (encountered + fixed)

- **`pg` ignores `postgresql:///ccgc` host and falls back to `PGHOST`/`PGUSER`/`PGPASSWORD` env vars** — Vercel's Neon integration auto-populates these in `.env.local`, so without intervention `pg` connects to Neon over plain TCP and fails. The script wipes all `PG*` and `POSTGRES_*` env vars at runtime before instantiating the source `Client`.
- **`pg` defaults empty host to TCP `localhost`** (not Unix socket like `psql` does), which fails password auth. The script explicitly passes `host: "/var/run/postgresql"`.
- **`dotenv` does not override existing env vars by default** — script passes `{ override: true }` to ensure `.env.local` wins over any shell-exported values.
- **`OVERRIDING SYSTEM VALUE` only works on identity columns**, not `serial`. Just specify `id` in the `INSERT` and reset the sequence with `setval` afterwards.
