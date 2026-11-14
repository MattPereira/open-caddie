// Client-safe. SQL predicates on round_summaries (db/schema.ts,
// modules/courses/lib/reads.ts, modules/players/lib/reads.ts) assume 18
// holes and must change with HOLE_COUNT.

export const HOLE_COUNT = 18;

export const HOLE_NUMBERS: readonly number[] = Array.from(
  { length: HOLE_COUNT },
  (_, i) => i + 1,
);
