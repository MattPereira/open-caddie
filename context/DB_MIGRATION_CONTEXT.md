# DB Migration: contra-costa-golf-club → open-caddie

Reference for `scripts/migrate-from-ccgc.ts`. Source schema: `contra-costa-golf-club/database/schema.pgsql`. Target schema: `open-caddie/db/schema.ts`.

## Schema diff

| Old | New | Key changes |
|---|---|---|
| `users` | `user` | PK `username` → `id` (UUID). `username` retained as unique. `password` dropped (Auth.js). Added `name` (synthesized as "First Last"), `image`, `emailVerified` (null on import). |
| — | **`clubs`** *(new)* | `id` PK, unique `handle`, `name`, `logo`, `point_rules` jsonb. Multi-tenancy primitive; handles remain URL slugs. |
| — | **`club_members`** *(new)* | Join table keyed by `(club_id, user_id)`. Every migrated legacy user is inserted as a member of the seeded CCGC club. |
| `courses`, `pars`, `handicaps` | `courses`, `course_holes` | `courses.id` is the PK, `courses.handle` remains a unique slug; legacy wide par/handicap rows become one `course_holes` row per course/hole keyed by `(course_id, hole)`. |
| `tour_years` grouping | `tournaments.season` | Removed the old `seasons` target table. Unique legacy `tour_years` values are ordered by oldest tournament date and written as integer `season` values starting at `1`. |
| `tournaments` | `tournaments` | PK `date` → `id` (serial). Added required `club_id`, required `course_id`, required `starts_at` (`time`), and integer `season`. Removed the old `(club_id, date)` unique index so a club can run multiple same-day tournaments. |
| `rounds` | `rounds` | Keeps legacy `id`, now has nullable `tournament_id` for standalone rounds, required `course_id`, required `date`, and required `user_id`. Calc columns dropped (derived on read). The `(tournament_id, user_id)` unique index is partial and only applies when `tournament_id IS NOT NULL`. |
| `strokes`, `putts`, `greenies` | `round_scores`, `greenies` | Legacy wide stroke/putt rows become one `round_scores` row per round/hole keyed by `(round_id, hole)`. `greenies` remains separate, but is keyed by `(round_id, hole)` and references `round_scores`, so there can be at most one greenie per scored hole. |
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

1. `clubs` — seed only `ccgc` id `1` with `point_rules`, then reset sequence. The old hacky `casual` club is no longer seeded.
2. `user`, `club_members` — generate UUIDs, build `username → id` map, then insert every migrated user into CCGC membership.
3. `courses`, `course_holes` — copy courses, build `course_handle → id` map, then combine deduped legacy `pars`/`handicaps` into one row per course/hole. Target column is `hole`; legacy source rows still use wide `hole1`...`hole18` fields.
4. `tournaments` — map unique legacy `tour_years` to integer `season` values by oldest date, insert with `club_id: 1`, required translated `course_id`, `starts_at: "10:00:00"`, and `season`, capture serial `id`, build `date → { id, courseId, date }` map. Tournaments with unknown `tour_years` or unknown `course_handle` are skipped.
5. `rounds` — preserve legacy `id` by passing it explicitly in `INSERT` (serial accepts override; sequence is reset after via `setval`). Migrated tournament rounds copy required `course_id` and `date` from their matched tournament.
6. `round_scores`, `greenies` — combine deduped legacy `strokes`/`putts` into one row per round/hole, then copy greenies. Target inserts use `hole`; legacy greenies still read source `hole_number`.

Large inserts are batched at 250 rows per request because Neon's HTTP driver rejects very large single insert requests.

## Current normalized hole naming

- Target hole-level tables use `hole`, not `hole_number`/`holeNumber`, because the integer type and golf context make "number" implicit.
- Affected target tables: `course_holes`, `round_scores`, `greenies`.
- Legacy source fields are unchanged in the script where they are read from the old database, such as `hole1`...`hole18` and `greenies.hole_number`.
- `greenies` no longer has an `id` column. Its primary key is `(round_id, hole)`, and it has a composite FK to `round_scores(round_id, hole)` with cascade delete.

## Tournament and round modeling notes

- `tournaments` remain official club-play events. They require a club, course, date, and local wall-clock start time.
- `starts_at` is a Postgres `time`, not a timestamp. Imported CCGC tournaments all use `10:00:00`, interpreted as the intended California local tee/event time without timezone conversion.
- The previous `tournaments_club_date_unique` constraint was removed. A club may schedule multiple tournaments on the same date.
- Standalone/casual play is represented as rounds with `tournament_id = NULL`, while still requiring `course_id` and `date`.
- Casual scoreboards can be derived at the application/query layer by grouping rounds by `(course_id, date)`. Add indexes later when those query patterns are implemented.

## Known data quirks (handled in script)

- **Duplicate rows in `pars`, `handicaps`, `strokes`, `putts`** — 10 courses and 142 rounds have exactly 2 identical rows each from a legacy edit bug (INSERT used where UPDATE was needed). Deduped via `SELECT DISTINCT ON (...)` before expanding into `course_holes` and `round_scores`.
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
pnpm db:migrate-from-ccgc
```

### Expected final row counts

```
clubs=1, club_members=33, users=33, courses=21, course_holes=378,
tournaments=55, rounds=620, round_scores=11160, greenies=603
```

### Idempotency

`TRUNCATE ... RESTART IDENTITY CASCADE` runs at the top of every execution. Rerun freely. The truncate includes migrated golf tables, `club_members`, plus Auth.js tables (`account`, `session`, `verificationToken`) before `"user"` so repeated imports do not leave auth rows referencing old imported users.

If resetting a Neon/Vercel target database by hand before `pnpm db:push`, include old removed tables too:

```sql
DROP TABLE IF EXISTS
  greenies,
  round_scores,
  rounds,
  tournaments,
  seasons,
  club_members,
  course_holes,
  courses,
  "account",
  "session",
  "verificationToken",
  "user",
  clubs
CASCADE;
```

## Gotchas (encountered + fixed)

- **`pg` ignores `postgresql:///ccgc` host and falls back to `PGHOST`/`PGUSER`/`PGPASSWORD` env vars** — Vercel's Neon integration auto-populates these in `.env.local`, so without intervention `pg` connects to Neon over plain TCP and fails. The script wipes all `PG*` and `POSTGRES_*` env vars at runtime before instantiating the source `Client`.
- **`pg` defaults empty host to TCP `localhost`** (not Unix socket like `psql` does), which fails password auth. The script explicitly passes `host: "/var/run/postgresql"`.
- **`dotenv` does not override existing env vars by default** — script passes `{ override: true }` to ensure `.env.local` wins over any shell-exported values.
- **`OVERRIDING SYSTEM VALUE` only works on identity columns**, not `serial`. Just specify `id` in the `INSERT` and reset the sequence with `setval` afterwards.
- **Neon HTTP rejects oversized single inserts** — normalized `round_scores` expands legacy `strokes`/`putts` into 11,160 rows. The script batches larger inserts instead of sending one giant SQL statement.
