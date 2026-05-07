import { cache } from "react";
import { asc, count, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { greenies, rounds, users } from "@/db/schema";

export const getUserById = cache(async (id: string) => {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
});

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUserById(session.user.id);
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
      roundsCount:
        sql<number>`coalesce("rc"."value", 0)`.mapWith(Number),
      greeniesCount:
        sql<number>`coalesce("gc"."value", 0)`.mapWith(Number),
    })
    .from(users)
    .leftJoin(roundsCountSq, eq(roundsCountSq.userId, users.id))
    .leftJoin(greeniesCountSq, eq(greeniesCountSq.userId, users.id))
    .orderBy(asc(users.firstName), asc(users.lastName), asc(users.email));
});
