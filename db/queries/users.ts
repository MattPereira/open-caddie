import { cache } from "react";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  clubs,
  courses,
  greenies,
  roundSummaries,
  rounds,
  tournaments,
  users,
} from "@/db/schema";

export const getUserById = cache(async (id: string) => {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
});

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUserById(session.user.id);
});

export const getUserPlayingStatsById = cache(async (userId: string) => {
  const [[row], [greeniesRow]] = await Promise.all([
    db
      .select({
        roundsCount: count(roundSummaries.roundId),
        averageStrokes: sql<
          number | null
        >`avg(${roundSummaries.totalStrokes}) filter (where ${roundSummaries.isComplete})::double precision`.mapWith(
          (value) => (value == null ? null : Number(value)),
        ),
        averagePutts: sql<
          number | null
        >`avg(${roundSummaries.totalPutts}) filter (where ${roundSummaries.recordedPuttsCount} = 18)::double precision`.mapWith(
          (value) => (value == null ? null : Number(value)),
        ),
      })
      .from(roundSummaries)
      .where(eq(roundSummaries.userId, userId)),
    db
      .select({ greeniesCount: count() })
      .from(greenies)
      .innerJoin(rounds, eq(greenies.roundId, rounds.id))
      .where(eq(rounds.userId, userId)),
  ]);

  const roundsCount = row?.roundsCount ?? 0;

  return {
    roundsCount,
    averageStrokes: row?.averageStrokes ?? null,
    averagePutts: row?.averagePutts ?? null,
    averageGreeniesPerRound:
      roundsCount === 0
        ? null
        : (greeniesRow?.greeniesCount ?? 0) / roundsCount,
  };
});

export const getUserRoundsById = cache(async (userId: string) => {
  return db
    .select({
      id: roundSummaries.roundId,
      date: roundSummaries.date,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      tournamentId: roundSummaries.tournamentId,
      tournamentSeason: tournaments.season,
      clubName: clubs.handle,
      totalStrokes: roundSummaries.totalStrokes,
      totalPutts: roundSummaries.totalPutts,
    })
    .from(roundSummaries)
    .innerJoin(courses, eq(roundSummaries.courseId, courses.id))
    .leftJoin(tournaments, eq(roundSummaries.tournamentId, tournaments.id))
    .leftJoin(clubs, eq(tournaments.clubId, clubs.id))
    .where(eq(roundSummaries.userId, userId))
    .orderBy(desc(roundSummaries.date), desc(roundSummaries.roundId));
});

export const getAllUsers = cache(async () => {
  const roundsCountSq = db
    .select({
      userId: rounds.userId,
      value: count().as("value"),
    })
    .from(rounds)
    .groupBy(rounds.userId)
    .as("rc");

  const greeniesCountSq = db
    .select({
      userId: rounds.userId,
      value: count().as("value"),
    })
    .from(greenies)
    .innerJoin(rounds, eq(greenies.roundId, rounds.id))
    .groupBy(rounds.userId)
    .as("gc");

  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      image: users.image,
      isAdmin: users.isAdmin,
      roundsCount: sql<number>`coalesce("rc"."value", 0)`.mapWith(Number),
      greeniesCount: sql<number>`coalesce("gc"."value", 0)`.mapWith(Number),
    })
    .from(users)
    .leftJoin(roundsCountSq, eq(roundsCountSq.userId, users.id))
    .leftJoin(greeniesCountSq, eq(greeniesCountSq.userId, users.id))
    .orderBy(asc(users.firstName), asc(users.lastName), asc(users.email));
});
