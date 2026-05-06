import { cache } from "react";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs, courses, rounds, tournaments } from "@/db/schema";

export const getAllTournaments = cache(async () => {
  return db
    .select({
      id: tournaments.id,
      clubId: tournaments.clubId,
      clubHandle: clubs.handle,
      clubName: clubs.name,
      date: tournaments.date,
      startsAt: tournaments.startsAt,
      courseId: tournaments.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
    })
    .from(tournaments)
    .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
    .leftJoin(courses, eq(tournaments.courseId, courses.id))
    .orderBy(desc(tournaments.date), desc(tournaments.startsAt));
});

export const getRoundsCountByTournamentId = cache(async (tournamentId: number) => {
  const [row] = await db
    .select({ value: count() })
    .from(rounds)
    .where(eq(rounds.tournamentId, tournamentId));
  return row?.value ?? 0;
});
