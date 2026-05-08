import { cache } from "react";
import { and, asc, count, desc, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  courses,
  greenies,
  roundScores,
  roundSummaries,
  rounds,
  users,
} from "@/db/schema";
import {
  calculateNetStrokes,
  calculatePlayerIndex,
  calculateTournamentHandicap,
} from "@/lib/scoring";

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

export const getRoundById = cache(async (roundId: number) => {
  const [round] = await db
    .select({
      id: roundSummaries.roundId,
      tournamentId: roundSummaries.tournamentId,
      clubId: roundSummaries.clubId,
      userId: roundSummaries.userId,
      date: roundSummaries.date,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      image: users.image,
      courseId: roundSummaries.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      courseRating: roundSummaries.courseRating,
      courseSlope: roundSummaries.courseSlope,
      recordedStrokesCount: roundSummaries.recordedStrokesCount,
      recordedPuttsCount: roundSummaries.recordedPuttsCount,
      totalStrokes: roundSummaries.totalStrokes,
      totalPutts: roundSummaries.totalPutts,
      isComplete: roundSummaries.isComplete,
      scoreDifferential: roundSummaries.scoreDifferential,
    })
    .from(roundSummaries)
    .innerJoin(users, eq(roundSummaries.userId, users.id))
    .innerJoin(courses, eq(roundSummaries.courseId, courses.id))
    .where(eq(roundSummaries.roundId, roundId))
    .limit(1);

  if (!round) {
    return round;
  }

  const [scores, roundGreenies] = await Promise.all([
    db
      .select({
        roundId: roundScores.roundId,
        hole: roundScores.hole,
        strokes: roundScores.strokes,
        putts: roundScores.putts,
      })
      .from(roundScores)
      .where(eq(roundScores.roundId, roundId))
      .orderBy(asc(roundScores.hole)),
    db
      .select({
        roundId: greenies.roundId,
        hole: greenies.hole,
        feet: greenies.feet,
        inches: greenies.inches,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        image: users.image,
        courseName: courses.name,
      })
      .from(greenies)
      .innerJoin(rounds, eq(greenies.roundId, rounds.id))
      .innerJoin(users, eq(rounds.userId, users.id))
      .innerJoin(courses, eq(rounds.courseId, courses.id))
      .where(eq(greenies.roundId, roundId))
      .orderBy(asc(greenies.hole)),
  ]);

  const priorScoreDifferentials =
    round.clubId == null
      ? []
      : await getPriorClubScoreDifferentials({
          userId: round.userId,
          clubId: round.clubId,
          beforeDate: round.date,
        });
  const playerIndex = calculatePlayerIndex(priorScoreDifferentials);
  const tournamentHandicap =
    round.clubId == null
      ? null
      : calculateTournamentHandicap(playerIndex, round.courseSlope);

  return {
    ...round,
    tournamentHandicap,
    netStrokes:
      tournamentHandicap == null
        ? null
        : calculateNetStrokes(
            round.isComplete ? round.totalStrokes : null,
            tournamentHandicap,
          ),
    scores,
    greenies: roundGreenies,
  };
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
