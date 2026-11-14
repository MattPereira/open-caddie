// Pure so client components can import it. SQL predicates on round_summaries
// (db/schema.ts, modules/courses/lib/queries.ts, modules/players/lib/queries.ts) mirror these
// rules and must change with them.

import { HOLE_COUNT } from "@/modules/courses/holes";

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
