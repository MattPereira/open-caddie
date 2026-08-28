import { cache } from "react";
import { asc, count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  courseHoles,
  courseTees,
  courses,
  matches,
  matchTeamMembers,
  matchTeams,
  roundSummaries,
  rounds,
  teeYardages,
  users,
} from "@/db/schema";
import { assessHandicap } from "@/lib/handicap";
import {
  groupByRoundId,
  readGreeniesByRounds,
  readScoresByRounds,
} from "@/lib/rounds/scorecards";

export const getAllMatches = cache(async () => {
  return db
    .select({
      id: matches.id,
      createdByUserId: matches.createdByUserId,
      creatorFirstName: users.firstName,
      creatorLastName: users.lastName,
      creatorUsername: users.username,
      date: matches.date,
      format: matches.format,
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
    .orderBy(desc(matches.date), desc(matches.id));
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
      format: matches.format,
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

  const [
    matchRounds,
    matchRoundScores,
    matchGreenies,
    matchHoles,
    matchTees,
    matchTeamRows,
  ] = await Promise.all([
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
          playerIndexOverride: roundSummaries.playerIndexOverride,
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
      readScoresByRounds(eq(rounds.matchId, matchId)),
      readGreeniesByRounds(eq(rounds.matchId, matchId)),
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
      db
        .select({
          id: matchTeams.id,
          matchId: matchTeams.matchId,
          name: matchTeams.name,
          sortOrder: matchTeams.sortOrder,
          roundId: matchTeamMembers.roundId,
        })
        .from(matchTeams)
        .leftJoin(
          matchTeamMembers,
          eq(matchTeamMembers.matchTeamId, matchTeams.id),
        )
        .where(eq(matchTeams.matchId, matchId))
        .orderBy(asc(matchTeams.sortOrder), asc(matchTeams.id)),
    ]);

  const scoresByRoundId = groupByRoundId(matchRoundScores);
  const greeniesByRoundId = groupByRoundId(matchGreenies);

  const roundsWithScores = matchRounds
    .map((round) => {
      const { courseHandicap: playingHandicap, netStrokes } = assessHandicap({
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

      return {
        ...round,
        playingHandicap,
        netStrokes,
        scores: scoresByRoundId.get(round.id) ?? [],
        holes: matchHoles,
        tees: matchTees,
        greenies: greeniesByRoundId.get(round.id) ?? [],
      };
    })
    .sort(compareMatchRoundStandings);
  const roundsById = new Map(roundsWithScores.map((round) => [round.id, round]));
  const teams = matchTeamRows.reduce<
    {
      id: number;
      matchId: number;
      name: string;
      sortOrder: number;
      rounds: typeof roundsWithScores;
    }[]
  >((acc, row) => {
    let team = acc.find((candidate) => candidate.id === row.id);

    if (!team) {
      team = {
        id: row.id,
        matchId: row.matchId,
        name: row.name,
        sortOrder: row.sortOrder,
        rounds: [],
      };
      acc.push(team);
    }

    const round = row.roundId == null ? null : roundsById.get(row.roundId);
    if (round) team.rounds.push(round);

    return acc;
  }, []);

  return {
    ...match,
    rounds: roundsWithScores,
    teams,
    greenies: matchGreenies,
  };
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
