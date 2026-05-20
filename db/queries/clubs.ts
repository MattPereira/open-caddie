import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubMembers, clubs, users } from "@/db/schema";
import type { PointRules } from "@/lib/point-rules-schema";

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
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      image: users.image,
      isAdmin: users.isAdmin,
    })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubMembers.clubId, clubs.id))
    .innerJoin(users, eq(clubMembers.userId, users.id))
    .where(eq(clubs.handle, handle))
    .orderBy(asc(users.firstName), asc(users.lastName), asc(users.email));
});
