import { sql } from "drizzle-orm";

import { db, type Transaction } from "@/db";

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
