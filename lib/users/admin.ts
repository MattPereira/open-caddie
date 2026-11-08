import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

/** False for an unknown user. */
export async function isAdmin(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.isAdmin === true;
}

/** Admin check for write modules; refuses with `error` instead of throwing. */
export async function requireAdmin(
  userId: string,
  error: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return (await isAdmin(userId)) ? { ok: true } : { ok: false, error };
}
