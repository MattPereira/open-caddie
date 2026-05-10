import { cache } from "react";
import { and, asc, count, desc, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  clubs,
  courseHoles,
  courses,
  greenies,
  roundScores,
  roundSummaries,
  rounds,
  tournaments,
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

export const getActiveRoundForUser = cache(async (userId: string) => {
  const [row] = await db
    .select({
      roundId: roundSummaries.roundId,
      tournamentId: roundSummaries.tournamentId,
      tournamentSeason: tournaments.season,
      courseId: roundSummaries.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      date: roundSummaries.date,
      isComplete: roundSummaries.isComplete,
    })
    .from(roundSummaries)
    .innerJoin(courses, eq(roundSummaries.courseId, courses.id))
    .leftJoin(tournaments, eq(roundSummaries.tournamentId, tournaments.id))
    .where(
      and(
        eq(roundSummaries.userId, userId),
        eq(roundSummaries.isComplete, false),
      ),
    )
    .orderBy(desc(roundSummaries.roundId))
    .limit(1);

  return row;
});

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
      clubName: clubs.name,
      tournamentSeason: tournaments.season,
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
    .leftJoin(tournaments, eq(roundSummaries.tournamentId, tournaments.id))
    .leftJoin(clubs, eq(tournaments.clubId, clubs.id))
    .where(eq(roundSummaries.roundId, roundId))
    .limit(1);

  if (!round) {
    return round;
  }

  const [holes, scores, roundGreenies] = await Promise.all([
    db
      .select({
        hole: courseHoles.hole,
        par: courseHoles.par,
      })
      .from(courseHoles)
      .where(eq(courseHoles.courseId, round.courseId))
      .orderBy(asc(courseHoles.hole)),
    db
      .select({
        roundId: roundScores.roundId,
        hole: roundScores.hole,
        par: courseHoles.par,
        strokes: roundScores.strokes,
        putts: roundScores.putts,
      })
      .from(roundScores)
      .leftJoin(
        courseHoles,
        and(
          eq(courseHoles.courseId, round.courseId),
          eq(courseHoles.hole, roundScores.hole),
        ),
      )
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

  const priorHandicapRounds =
    round.clubId == null
      ? []
      : await getPriorClubScoreDifferentialRounds({
          userId: round.userId,
          clubId: round.clubId,
          beforeDate: round.date,
        });
  const priorScoreDifferentials = priorHandicapRounds.map(
    (priorRound) => priorRound.scoreDifferential,
  );
  const playerIndex = calculatePlayerIndex(priorScoreDifferentials);
  const tournamentHandicap =
    round.clubId == null
      ? null
      : calculateTournamentHandicap(playerIndex, round.courseSlope);
  const usedPriorRoundIds = new Set(
    playerIndex == null
      ? []
      : [...priorHandicapRounds]
          .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
          .slice(0, 2)
          .map((priorRound) => priorRound.id),
  );

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
    holes,
    greenies: roundGreenies,
    handicap:
      round.tournamentId == null || round.clubId == null
        ? null
        : {
            priorRounds: priorHandicapRounds.map((priorRound) => ({
              ...priorRound,
              usedForPlayerIndex: usedPriorRoundIds.has(priorRound.id),
            })),
            playerIndex,
            tournamentHandicap,
          },
  };
});

export const getPriorClubScoreDifferentialRounds = cache(
  async ({
    userId,
    clubId,
    beforeDate,
    limit = 4,
  }: PriorClubScoreDifferentialsParams) => {
    const rows = await db
      .select({
        id: roundSummaries.roundId,
        date: roundSummaries.date,
        courseHandle: courses.handle,
        courseName: courses.name,
        courseRating: roundSummaries.courseRating,
        courseSlope: roundSummaries.courseSlope,
        totalStrokes: roundSummaries.totalStrokes,
        scoreDifferential: roundSummaries.scoreDifferential,
      })
      .from(roundSummaries)
      .innerJoin(courses, eq(roundSummaries.courseId, courses.id))
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

    return rows.filter(
      (row): row is (typeof rows)[number] & { scoreDifferential: number } => {
        return row.scoreDifferential != null;
      },
    );
  },
);

export const getPriorClubScoreDifferentials = cache(
  async ({
    userId,
    clubId,
    beforeDate,
    limit = 4,
  }: PriorClubScoreDifferentialsParams) => {
    const rows = await getPriorClubScoreDifferentialRounds({
      userId,
      clubId,
      beforeDate,
      limit,
    });

    return rows.map((row) => row.scoreDifferential);
  },
);
