import { cache } from "react";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { greenies, rounds } from "@/db/schema";

export const getGreeniesCountByUserId = cache(async (userId: string) => {
  const [row] = await db
    .select({ value: count() })
    .from(greenies)
    .innerJoin(rounds, eq(greenies.roundId, rounds.id))
    .where(eq(rounds.userId, userId));
  return row?.value ?? 0;
});
