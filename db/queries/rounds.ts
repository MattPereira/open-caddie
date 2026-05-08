import { cache } from "react";
import { and, count, desc, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { roundSummaries, rounds } from "@/db/schema";

type PriorClubScoreDifferentialsParams = {
  userId: string;
  clubId: number;
  beforeDate: Date;
  limit?: number;
};

export const getRoundsCountByUserId = cache(async (userId: string) => {
  const [row] = await db
    .select({ value: count() })
    .from(rounds)
    .where(eq(rounds.userId, userId));
  return row?.value ?? 0;
});

export const getPriorClubScoreDifferentials = cache(
  async ({
    userId,
    clubId,
    beforeDate,
    limit = 4,
  }: PriorClubScoreDifferentialsParams) => {
    const rows = await db
      .select({
        scoreDifferential: roundSummaries.scoreDifferential,
      })
      .from(roundSummaries)
      .where(
        and(
          eq(roundSummaries.userId, userId),
          eq(roundSummaries.clubId, clubId),
          isNotNull(roundSummaries.tournamentId),
          eq(roundSummaries.isComplete, true),
          isNotNull(roundSummaries.scoreDifferential),
          lt(roundSummaries.date, beforeDate),
        ),
      )
      .orderBy(desc(roundSummaries.date), desc(roundSummaries.roundId))
      .limit(limit);

    return rows
      .map((row) => row.scoreDifferential)
      .filter((scoreDifferential): scoreDifferential is number => {
        return scoreDifferential != null;
      });
  },
);
