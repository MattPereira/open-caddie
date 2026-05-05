import { cache } from "react";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { rounds } from "@/db/schema";

export const getRoundsCountByUserId = cache(async (userId: string) => {
  const [row] = await db
    .select({ value: count() })
    .from(rounds)
    .where(eq(rounds.userId, userId));
  return row?.value ?? 0;
});
