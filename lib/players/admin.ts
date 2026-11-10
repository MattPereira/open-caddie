import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

/** False for an unknown Player. */
export async function isAdmin(playerId: string): Promise<boolean> {
  const [player] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, playerId))
    .limit(1);
  return player?.isAdmin === true;
}

/** Admin check for write modules; refuses with `error` instead of throwing. */
export async function requireAdmin(
  playerId: string,
  error: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return (await isAdmin(playerId)) ? { ok: true } : { ok: false, error };
}
