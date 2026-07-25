import { cache } from "react";
import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clubMembers,
  clubs,
  greenies,
  rounds,
  seasons,
  tournaments,
  users,
} from "@/db/schema";
import type { PointRules } from "@/lib/clubs/standings/point-rules";

export const getAllClubs = cache(async () => {
  return db
    .select({ id: clubs.id, handle: clubs.handle, name: clubs.name })
    .from(clubs)
    .orderBy(asc(clubs.name));
});

export const getAllClubsWithSeasons = cache(async () => {
  const [clubRows, seasonRows] = await Promise.all([
    getAllClubs(),
    db.select().from(seasons).orderBy(asc(seasons.number)),
  ]);
  return clubRows.map((club) => {
    const clubSeasons = seasonRows.filter((season) => season.clubId === club.id);
    return {
      ...club,
      seasons: clubSeasons,
      // A Club's Current Season is its highest-numbered one, and the rows are
      // ordered by number, so it is the last of the Club's Seasons. Callers
      // read this rather than re-deriving the rule.
      currentSeasonId: clubSeasons.at(-1)?.id ?? null,
    };
  });
});

export const getAllClubsFull = cache(async () => {
  const membersCountSq = db
    .select({
      clubId: clubMembers.clubId,
      value: count().as("value"),
    })
    .from(clubMembers)
    .groupBy(clubMembers.clubId)
    .as("mc");

  const tournamentsCountSq = db
    .select({
      clubId: seasons.clubId,
      value: count().as("value"),
    })
    .from(tournaments)
    .innerJoin(seasons, eq(tournaments.seasonId, seasons.id))
    .groupBy(seasons.clubId)
    .as("tc");

  const rows = await db
    .select({
      id: clubs.id,
      handle: clubs.handle,
      name: clubs.name,
      logo: clubs.logo,
      pointRules: clubs.pointRules,
      membersCount: sql<number>`coalesce("mc"."value", 0)`.mapWith(Number),
      tournamentsCount: sql<number>`coalesce("tc"."value", 0)`.mapWith(Number),
    })
    .from(clubs)
    .leftJoin(membersCountSq, eq(membersCountSq.clubId, clubs.id))
    .leftJoin(tournamentsCountSq, eq(tournamentsCountSq.clubId, clubs.id))
    .orderBy(asc(clubs.name));
  return rows.map((r) => ({
    ...r,
    pointRules: r.pointRules as PointRules,
  }));
});

export const getClubByHandle = cache(async (handle: string) => {
  const [row] = await db
    .select({
      id: clubs.id,
      handle: clubs.handle,
      name: clubs.name,
      logo: clubs.logo,
      pointRules: clubs.pointRules,
    })
    .from(clubs)
    .where(eq(clubs.handle, handle))
    .limit(1);

  return row
    ? {
        ...row,
        pointRules: row.pointRules as PointRules,
      }
    : null;
});

export const getClubMembersByHandle = cache(async (handle: string) => {
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
    .from(clubMembers)
    .innerJoin(clubs, eq(clubMembers.clubId, clubs.id))
    .innerJoin(users, eq(clubMembers.userId, users.id))
    .leftJoin(roundsCountSq, eq(roundsCountSq.userId, users.id))
    .leftJoin(greeniesCountSq, eq(greeniesCountSq.userId, users.id))
    .where(eq(clubs.handle, handle))
    .orderBy(asc(users.firstName), asc(users.lastName), asc(users.email));
});
