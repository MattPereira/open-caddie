import { cache } from "react";
import { and, asc, count, desc, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clubs,
  courseHoles,
  courseTees,
  courses,
  greenies,
  roundScores,
  roundSummaries,
  rounds,
  teeYardages,
  tournaments,
  users,
} from "@/db/schema";
import { assessHandicap } from "@/lib/handicap";
import { calculateNetStrokes } from "@/lib/scoring";

type PriorClubScoreDifferentialsParams = {
  userId: string;
  clubId: number;
  beforeDate: Date;
  limit?: number;
};

export const getLowestRounds = cache(async (limit = 10) => {
  return db
    .select({
      roundId: roundSummaries.roundId,
      date: roundSummaries.date,
      totalStrokes: roundSummaries.totalStrokes,
      courseName: courses.name,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      email: users.email,
      image: users.image,
    })
    .from(roundSummaries)
    .innerJoin(users, eq(roundSummaries.userId, users.id))
    .innerJoin(courses, eq(roundSummaries.courseId, courses.id))
    .where(eq(roundSummaries.isComplete, true))
    .orderBy(asc(roundSummaries.totalStrokes), desc(roundSummaries.date))
    .limit(limit);
});

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
      matchId: roundSummaries.matchId,
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
      teeId: rounds.teeId,
      courseRating: roundSummaries.courseRating,
      courseSlope: roundSummaries.courseSlope,
      recordedStrokesCount: roundSummaries.recordedStrokesCount,
      recordedPuttsCount: roundSummaries.recordedPuttsCount,
      totalStrokes: roundSummaries.totalStrokes,
      totalPutts: roundSummaries.totalPutts,
      isComplete: roundSummaries.isComplete,
      scoreDifferential: roundSummaries.scoreDifferential,
      playerIndexOverride: roundSummaries.playerIndexOverride,
    })
    .from(roundSummaries)
    .innerJoin(rounds, eq(rounds.id, roundSummaries.roundId))
    .innerJoin(users, eq(roundSummaries.userId, users.id))
    .innerJoin(courses, eq(roundSummaries.courseId, courses.id))
    .leftJoin(tournaments, eq(roundSummaries.tournamentId, tournaments.id))
    .leftJoin(clubs, eq(tournaments.clubId, clubs.id))
    .where(eq(roundSummaries.roundId, roundId))
    .limit(1);

  if (!round) {
    return round;
  }

  const [holes, scores, roundGreenies, tees] = await Promise.all([
    db
      .select({
        hole: courseHoles.hole,
        par: courseHoles.par,
        handicap: courseHoles.handicap,
        yards: teeYardages.yards,
      })
      .from(courseHoles)
      .leftJoin(
        teeYardages,
        and(
          eq(teeYardages.teeId, round.teeId),
          eq(teeYardages.hole, courseHoles.hole),
        ),
      )
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
    db
      .select({
        id: courseTees.id,
        name: courseTees.name,
        color: courseTees.color,
        rating: courseTees.rating,
        slope: courseTees.slope,
        totalYards: sql<number | null>`sum(${teeYardages.yards})::int`.mapWith(
          (value) => (value == null ? null : Number(value)),
        ),
      })
      .from(courseTees)
      .leftJoin(teeYardages, eq(teeYardages.teeId, courseTees.id))
      .where(eq(courseTees.courseId, round.courseId))
      .groupBy(
        courseTees.id,
        courseTees.name,
        courseTees.color,
        courseTees.rating,
        courseTees.slope,
        courseTees.sortOrder,
      )
      .orderBy(asc(courseTees.sortOrder), asc(courseTees.id)),
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
  const computed = assessHandicap({
    source: { kind: "computed", priorDifferentials: priorScoreDifferentials },
    slope: round.courseSlope,
    totalStrokes: round.totalStrokes,
    isComplete: round.isComplete,
  });
  const override = assessHandicap({
    source: {
      kind: "override",
      playerIndex:
        round.playerIndexOverride == null
          ? 0
          : Number(round.playerIndexOverride),
    },
    slope: round.courseSlope,
    totalStrokes: round.totalStrokes,
    isComplete: round.isComplete,
  });
  const playerIndex = computed.playerIndex;
  const courseHandicap =
    round.clubId == null ? null : computed.courseHandicap;
  const matchHandicap = round.matchId == null ? null : override.courseHandicap;
  // A Player Index Override's Course Handicap takes precedence over the
  // computed one when resolving this round's Playing Handicap.
  const playingHandicap = matchHandicap ?? courseHandicap;
  const usedPriorRoundIds = new Set(
    computed.usedDifferentialIndexes.map(
      (index) => priorHandicapRounds[index].id,
    ),
  );

  return {
    ...round,
    courseHandicap,
    playingHandicap,
    netStrokes:
      playingHandicap == null
        ? null
        : calculateNetStrokes(
            round.isComplete ? round.totalStrokes : null,
            playingHandicap,
          ),
    scores,
    holes,
    tees,
    greenies: roundGreenies,
    handicapDetails:
      round.tournamentId == null || round.clubId == null
        ? null
        : {
            priorRounds: priorHandicapRounds.map((priorRound) => ({
              ...priorRound,
              usedForPlayerIndex: usedPriorRoundIds.has(priorRound.id),
            })),
            playerIndex,
            courseHandicap,
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
