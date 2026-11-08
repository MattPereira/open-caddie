import { cache } from "react";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  clubs,
  courses,
  roundSummaries,
  rounds,
  seasons,
  tournaments,
  users,
} from "@/db/schema";
import { readRound } from "@/lib/rounds/reads";
import {
  groupByRoundId,
  readScorecardsByRounds,
} from "@/lib/rounds/scorecards";

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
      tournamentSeason: seasons.number,
      courseId: roundSummaries.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      date: roundSummaries.date,
      isComplete: roundSummaries.isComplete,
    })
    .from(roundSummaries)
    .innerJoin(courses, eq(roundSummaries.courseId, courses.id))
    .leftJoin(tournaments, eq(roundSummaries.tournamentId, tournaments.id))
    .leftJoin(seasons, eq(tournaments.seasonId, seasons.id))
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

/**
 * The play page's columns for other players: each Round's player and what's on
 * their card, in the order given. Callers pass only Rounds the access read says
 * the viewer may score.
 */
export const getScorableRounds = cache(async (roundIds: readonly number[]) => {
  if (roundIds.length === 0) return [];

  const [players, { scores, greenies: greenieRows }] = await Promise.all([
    db
      .select({
        roundId: rounds.id,
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(rounds)
      .innerJoin(users, eq(users.id, rounds.userId))
      .where(inArray(rounds.id, [...roundIds])),
    readScorecardsByRounds(inArray(rounds.id, [...roundIds])),
  ]);
  const playersByRoundId = new Map(
    players.map((player) => [player.roundId, player]),
  );
  const scoresByRoundId = groupByRoundId(scores);
  const greeniesByRoundId = groupByRoundId(greenieRows);

  // The form wants only what a player enters, not the reader's wider row.
  return roundIds.flatMap((roundId) => {
    const player = playersByRoundId.get(roundId);
    if (!player) return [];
    return {
      ...player,
      scores: (scoresByRoundId.get(roundId) ?? []).map(
        ({ hole, par, strokes, putts }) => ({ hole, par, strokes, putts }),
      ),
      greenies: (greeniesByRoundId.get(roundId) ?? []).map(
        ({ hole, feet, inches }) => ({ hole, feet, inches }),
      ),
    };
  });
});

export type ScorableRound = Awaited<ReturnType<typeof getScorableRounds>>[number];

export const getRoundById = cache(async (roundId: number) => {
  const [[header], read] = await Promise.all([
    db
      .select({
        clubId: seasons.clubId,
        clubName: clubs.name,
        tournamentSeason: seasons.number,
        courseHandle: courses.handle,
        courseName: courses.name,
        courseImgUrl: courses.imgUrl,
      })
      .from(rounds)
      .innerJoin(courses, eq(rounds.courseId, courses.id))
      .leftJoin(tournaments, eq(rounds.tournamentId, tournaments.id))
      .leftJoin(seasons, eq(tournaments.seasonId, seasons.id))
      .leftJoin(clubs, eq(seasons.clubId, clubs.id))
      .where(eq(rounds.id, roundId))
      .limit(1),
    readRound(roundId, true),
  ]);

  if (!header || !read) return undefined;

  const [round] = read.rounds;
  const yardsByHole = new Map(round.yards.map(({ hole, yards }) => [hole, yards]));

  return {
    ...round,
    ...header,
    tournamentId: round.kind === "tournament" ? round.tournamentId : null,
    matchId: round.kind === "match" ? round.matchId : null,
    playerIndexOverride:
      round.kind === "match" ? round.playerIndexOverride : null,
    holes: read.course.holes.map((hole) => ({
      ...hole,
      yards: yardsByHole.get(hole.hole) ?? null,
    })),
    tees: read.course.tees,
  };
});
