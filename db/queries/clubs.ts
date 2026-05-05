import { cache } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { clubs } from "@/db/schema";
import type { PointRules } from "@/app/(app)/admin/schema";

export const getAllClubs = cache(async () => {
  return db
    .select({ id: clubs.id, handle: clubs.handle, name: clubs.name })
    .from(clubs)
    .orderBy(asc(clubs.name));
});

export const getAllClubsFull = cache(async () => {
  const rows = await db
    .select({
      id: clubs.id,
      handle: clubs.handle,
      name: clubs.name,
      logo: clubs.logo,
      pointRules: clubs.pointRules,
    })
    .from(clubs)
    .orderBy(asc(clubs.name));
  return rows.map((r) => ({
    ...r,
    pointRules: r.pointRules as PointRules,
  }));
});
