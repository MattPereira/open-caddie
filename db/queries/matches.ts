import { cache } from "react";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  courseHoles,
  courseTees,
  courses,
  greenies,
  matches,
  roundScores,
  roundSummaries,
  rounds,
  teeYardages,
  users,
} from "@/db/schema";
import {
  calculateNetStrokes,
  calculateCourseHandicap,
} from "@/lib/scoring";

export const getAllMatches = cache(async () => {
  return db
    .select({
      id: matches.id,
      createdByUserId: matches.createdByUserId,
      creatorFirstName: users.firstName,
      creatorLastName: users.lastName,
      creatorUsername: users.username,
      date: matches.date,
      startsAt: matches.startsAt,
      name: matches.name,
      courseId: matches.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      playerCount: count(rounds.id).mapWith(Number),
    })
    .from(matches)
    .innerJoin(users, eq(matches.createdByUserId, users.id))
    .innerJoin(courses, eq(matches.courseId, courses.id))
    .leftJoin(rounds, eq(rounds.matchId, matches.id))
    .groupBy(
      matches.id,
      users.firstName,
      users.lastName,
      users.username,
      courses.handle,
      courses.name,
      courses.imgUrl,
    )
    .orderBy(desc(matches.date), desc(matches.startsAt));
});

export const getMatchById = cache(async (matchId: number) => {
  const [match] = await db
    .select({
      id: matches.id,
      createdByUserId: matches.createdByUserId,
      creatorFirstName: users.firstName,
      creatorLastName: users.lastName,
      creatorUsername: users.username,
      date: matches.date,
      startsAt: matches.startsAt,
      name: matches.name,
      courseId: matches.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
    })
    .from(matches)
    .innerJoin(users, eq(matches.createdByUserId, users.id))
    .innerJoin(courses, eq(matches.courseId, courses.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) return match;

  const [matchRounds, matchRoundScores, matchGreenies, matchHoles, matchTees] =
    await Promise.all([
      db
        .select({
          id: roundSummaries.roundId,
          matchId: roundSummaries.matchId,
          teeId: rounds.teeId,
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
          handicapIndexOverride: roundSummaries.handicapIndexOverride,
          recordedStrokesCount: roundSummaries.recordedStrokesCount,
          recordedPuttsCount: roundSummaries.recordedPuttsCount,
          totalStrokes: roundSummaries.totalStrokes,
          totalPutts: roundSummaries.totalPutts,
          isComplete: roundSummaries.isComplete,
          scoreDifferential: roundSummaries.scoreDifferential,
        })
        .from(roundSummaries)
        .innerJoin(rounds, eq(rounds.id, roundSummaries.roundId))
        .innerJoin(users, eq(roundSummaries.userId, users.id))
        .innerJoin(courses, eq(roundSummaries.courseId, courses.id))
        .where(eq(roundSummaries.matchId, matchId))
        .orderBy(
          asc(users.lastName),
          asc(users.firstName),
          asc(users.username),
        ),
      db
        .select({
          roundId: roundScores.roundId,
          hole: roundScores.hole,
          par: courseHoles.par,
          handicap: courseHoles.handicap,
          strokes: roundScores.strokes,
          putts: roundScores.putts,
        })
        .from(roundScores)
        .innerJoin(rounds, eq(roundScores.roundId, rounds.id))
        .leftJoin(
          courseHoles,
          and(
            eq(courseHoles.courseId, rounds.courseId),
            eq(courseHoles.hole, roundScores.hole),
          ),
        )
        .where(eq(rounds.matchId, matchId))
        .orderBy(asc(roundScores.roundId), asc(roundScores.hole)),
      db
        .select({
          roundId: greenies.roundId,
          hole: greenies.hole,
          feet: greenies.feet,
          inches: greenies.inches,
          roundDate: rounds.date,
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
        .where(eq(rounds.matchId, matchId))
        .orderBy(asc(greenies.hole), asc(greenies.feet), asc(greenies.inches)),
      db
        .select({
          hole: courseHoles.hole,
          par: courseHoles.par,
          handicap: courseHoles.handicap,
        })
        .from(courseHoles)
        .where(eq(courseHoles.courseId, match.courseId))
        .orderBy(asc(courseHoles.hole)),
      db
        .select({
          id: courseTees.id,
          name: courseTees.name,
          color: courseTees.color,
          rating: courseTees.rating,
          slope: courseTees.slope,
          totalYards:
            sql<number | null>`sum(${teeYardages.yards})::int`.mapWith(
              (value) => (value == null ? null : Number(value)),
            ),
        })
        .from(courseTees)
        .leftJoin(teeYardages, eq(teeYardages.teeId, courseTees.id))
        .where(eq(courseTees.courseId, match.courseId))
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

  const scoresByRoundId = new Map<number, typeof matchRoundScores>();
  for (const score of matchRoundScores) {
    const scores = scoresByRoundId.get(score.roundId) ?? [];
    scores.push(score);
    scoresByRoundId.set(score.roundId, scores);
  }

  const greeniesByRoundId = new Map<number, typeof matchGreenies>();
  for (const greenie of matchGreenies) {
    const roundGreenies = greeniesByRoundId.get(greenie.roundId) ?? [];
    roundGreenies.push(greenie);
    greeniesByRoundId.set(greenie.roundId, roundGreenies);
  }

  const roundsWithScores = matchRounds
    .map((round) => {
      const handicapIndex =
        round.handicapIndexOverride == null
          ? 0
          : Number(round.handicapIndexOverride);
      const playingHandicap = calculateCourseHandicap(
        handicapIndex,
        round.courseSlope,
      );

      return {
        ...round,
        playingHandicap,
        netStrokes: calculateNetStrokes(
          round.isComplete ? round.totalStrokes : null,
          playingHandicap,
        ),
        scores: scoresByRoundId.get(round.id) ?? [],
        holes: matchHoles,
        tees: matchTees,
        greenies: greeniesByRoundId.get(round.id) ?? [],
      };
    })
    .sort(compareMatchRoundStandings);

  return {
    ...match,
    rounds: roundsWithScores,
    greenies: matchGreenies,
  };
});

export const getAddablePlayersForMatch = cache(async (matchId: number) => {
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      image: users.image,
      isAdmin: users.isAdmin,
    })
    .from(users)
    .innerJoin(matches, eq(matches.id, matchId))
    .leftJoin(
      rounds,
      and(eq(rounds.userId, users.id), eq(rounds.matchId, matchId)),
    )
    .where(isNull(rounds.id))
    .orderBy(asc(users.firstName), asc(users.lastName), asc(users.username));
});

function compareMatchRoundStandings<
  T extends {
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    netStrokes: number | null;
    totalStrokes: number;
  },
>(a: T, b: T) {
  if (a.netStrokes == null && b.netStrokes == null) {
    return compareMatchRoundPlayers(a, b);
  }

  if (a.netStrokes == null) return 1;
  if (b.netStrokes == null) return -1;

  const netCompare = a.netStrokes - b.netStrokes;
  if (netCompare !== 0) return netCompare;

  const grossCompare = a.totalStrokes - b.totalStrokes;
  if (grossCompare !== 0) return grossCompare;

  return compareMatchRoundPlayers(a, b);
}

function compareMatchRoundPlayers(
  a: {
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  },
  b: {
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  },
) {
  return (
    (a.lastName ?? "").localeCompare(b.lastName ?? "") ||
    (a.firstName ?? "").localeCompare(b.firstName ?? "") ||
    (a.username ?? "").localeCompare(b.username ?? "")
  );
}
