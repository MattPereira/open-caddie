// Pure so client components can import it. SQL predicates on round_summaries
// (db/schema.ts, lib/courses/queries.ts, lib/users/queries.ts) mirror these
// rules and must change with them.

export const HOLE_COUNT = 18;

export const HOLE_NUMBERS: readonly number[] = Array.from(
  { length: HOLE_COUNT },
  (_, i) => i + 1,
);

export type RecordedCounts = {
  recordedStrokesCount: number;
  recordedPuttsCount: number;
};

export function isComplete(round: Pick<RecordedCounts, "recordedStrokesCount">) {
  return round.recordedStrokesCount === HOLE_COUNT;
}

// Putts ranking eligibility. Independent of isComplete; callers that need
// both check both.
export function hasAllPutts(round: Pick<RecordedCounts, "recordedPuttsCount">) {
  return round.recordedPuttsCount === HOLE_COUNT;
}
