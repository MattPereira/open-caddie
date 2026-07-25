import { cache } from "react";
import { asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs, courses, greenies, rounds, seasons, tournaments, users } from "@/db/schema";

export const getAllGreenies = cache(async () => {
  return db
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
      courseId: courses.id,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      clubName: clubs.name,
      season: seasons.number,
    })
    .from(greenies)
    .innerJoin(rounds, eq(greenies.roundId, rounds.id))
    .innerJoin(users, eq(rounds.userId, users.id))
    .innerJoin(courses, eq(rounds.courseId, courses.id))
    .leftJoin(tournaments, eq(rounds.tournamentId, tournaments.id))
    .leftJoin(seasons, eq(tournaments.seasonId, seasons.id))
    .leftJoin(clubs, eq(seasons.clubId, clubs.id))
    .orderBy(desc(rounds.date), desc(greenies.feet), desc(greenies.inches));
});

export const getClosestGreenies = cache(async (limit = 10) => {
  return db
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
      courseId: courses.id,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      clubName: clubs.name,
      season: seasons.number,
    })
    .from(greenies)
    .innerJoin(rounds, eq(greenies.roundId, rounds.id))
    .innerJoin(users, eq(rounds.userId, users.id))
    .innerJoin(courses, eq(rounds.courseId, courses.id))
    .leftJoin(tournaments, eq(rounds.tournamentId, tournaments.id))
    .leftJoin(seasons, eq(tournaments.seasonId, seasons.id))
    .leftJoin(clubs, eq(seasons.clubId, clubs.id))
    .orderBy(asc(greenies.feet), asc(greenies.inches), desc(rounds.date))
    .limit(limit);
});

export const getGreeniesCountByUserId = cache(async (userId: string) => {
  const [row] = await db
    .select({ value: count() })
    .from(greenies)
    .innerJoin(rounds, eq(greenies.roundId, rounds.id))
    .where(eq(rounds.userId, userId));
  return row?.value ?? 0;
});
