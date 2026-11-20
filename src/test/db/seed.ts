import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

// Every entry-point write needs an acting Platform Admin, and making a Player
// is one of them, so this row can't come from an entry point.
export async function seedPlatformAdmin() {
  const suffix = crypto.randomUUID();
  const [admin] = await db
    .insert(users)
    .values({
      email: `admin-${suffix}@example.com`,
      firstName: "Admin",
      lastName: suffix,
      isAdmin: true,
    })
    .returning({ id: users.id });
  return admin;
}

// Auth.js sets emailVerified when a Player signs in by email link; no module
// entry point writes it.
export async function markEmailVerified(playerId: string, at: Date) {
  await db
    .update(users)
    .set({ emailVerified: at })
    .where(eq(users.id, playerId));
}
