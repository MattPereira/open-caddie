// Client-safe. SQL predicates on round_summaries (db/schema.ts,
// modules/courses/lib/queries.ts, modules/players/lib/queries.ts) assume 18
// holes and must change with HOLE_COUNT.

export const HOLE_COUNT = 18;

export const HOLE_NUMBERS: readonly number[] = Array.from(
  { length: HOLE_COUNT },
  (_, i) => i + 1,
);
