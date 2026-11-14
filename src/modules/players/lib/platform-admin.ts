import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

/** Reads the stored row, not the session. False for an unknown Player. */
export async function isPlatformAdmin(playerId: string): Promise<boolean> {
  const [player] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, playerId))
    .limit(1);
  return player?.isAdmin === true;
}

/** Platform Admin check for write modules; refuses with `error` instead of throwing. */
export async function requirePlatformAdmin(
  playerId: string,
  error: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return (await isPlatformAdmin(playerId)) ? { ok: true } : { ok: false, error };
}
