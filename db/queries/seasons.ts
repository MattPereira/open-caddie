import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs, seasons } from "@/db/schema";

export const getAllSeasons = cache(async () => {
  return db
    .select({
      id: seasons.id,
      clubId: seasons.clubId,
      clubHandle: clubs.handle,
      clubName: clubs.name,
      number: seasons.number,
      startDate: seasons.startDate,
      endDate: seasons.endDate,
    })
    .from(seasons)
    .innerJoin(clubs, eq(seasons.clubId, clubs.id))
    .orderBy(asc(clubs.name), asc(seasons.number));
});
