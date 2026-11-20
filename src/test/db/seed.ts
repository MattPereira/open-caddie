import { sql } from "drizzle-orm";

import { db, type Transaction } from "@/db";
import { users } from "@/db/schema";

// The one row tests insert directly: every entry-point write needs an acting
// Platform Admin, and making a Player is one of them.
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

/** For entry points that take the caller's transaction. */
export function withTransaction<T>(fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(fn);
}

/** Opens `count` pool connections so connection setup can't serialize a race. */
export async function warmConnections(count: number) {
  await Promise.all(
    Array.from({ length: count }, () => db.execute(sql`select 1`)),
  );
}
