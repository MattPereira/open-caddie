import { cache } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { clubs } from "@/db/schema";

export const getAllClubs = cache(async () => {
  return db
    .select({ handle: clubs.handle, name: clubs.name })
    .from(clubs)
    .orderBy(asc(clubs.name));
});
