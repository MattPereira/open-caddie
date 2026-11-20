import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

// Auth.js sets emailVerified when a Player signs in by email link; no module
// entry point writes it.
export async function markEmailVerified(playerId: string, at: Date) {
  await db
    .update(users)
    .set({ emailVerified: at })
    .where(eq(users.id, playerId));
}
