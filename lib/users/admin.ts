import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

/** Admin check for write modules; refuses with `error` instead of throwing. */
export async function requireAdmin(
  userId: string,
  error: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.isAdmin === true ? { ok: true } : { ok: false, error };
}
