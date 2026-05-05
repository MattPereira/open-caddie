import { cache } from "react";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs, courses, rounds, tournaments } from "@/db/schema";

export const getAllTournaments = cache(async () => {
  return db
    .select({
      id: tournaments.id,
      clubHandle: tournaments.clubHandle,
      clubName: clubs.name,
      date: tournaments.date,
      courseHandle: tournaments.courseHandle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      tourYears: tournaments.tourYears,
    })
    .from(tournaments)
    .innerJoin(clubs, eq(tournaments.clubHandle, clubs.handle))
    .leftJoin(courses, eq(tournaments.courseHandle, courses.handle))
    .orderBy(desc(tournaments.date));
});

export const getRoundsCountByTournamentId = cache(async (tournamentId: number) => {
  const [row] = await db
    .select({ value: count() })
    .from(rounds)
    .where(eq(rounds.tournamentId, tournamentId));
  return row?.value ?? 0;
});

export const getUniqueTourYears = cache(async () => {
  const rows = await db
    .selectDistinct({ tourYears: tournaments.tourYears })
    .from(tournaments)
    .orderBy(desc(tournaments.tourYears));
  return rows.map((r) => r.tourYears);
});
