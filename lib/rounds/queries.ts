import { cache } from "react";
import { and, asc, count, desc, eq } from "drizzle-orm";
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
    .innerJoin(users, eq(roundSummaries.playerId, users.id))
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
        eq(roundSummaries.playerId, userId),
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
    .where(eq(rounds.playerId, userId));
  return row?.value ?? 0;
});

export const getRoundById = cache(
  async (roundId: number, withHandicapDetails = false) => {
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
      readRound(roundId, withHandicapDetails),
    ]);

    if (!header || !read) return undefined;

    return {
      ...read.rounds[0],
      ...header,
      course: read.course,
      handicapDetails: read.handicapDetails,
    };
  },
);
