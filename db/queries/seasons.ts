import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs, seasons } from "@/db/schema";

export const getAllSeasons = cache(async () => {
  return db
    .select({
      id: seasons.id,
      clubHandle: seasons.clubHandle,
      clubName: clubs.name,
      number: seasons.number,
      startDate: seasons.startDate,
      endDate: seasons.endDate,
    })
    .from(seasons)
    .innerJoin(clubs, eq(seasons.clubHandle, clubs.handle))
    .orderBy(asc(clubs.name), asc(seasons.number));
});
