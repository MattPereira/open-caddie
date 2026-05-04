import { cache } from "react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export const getUserById = cache(async (id: string) => {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
});

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUserById(session.user.id);
});
