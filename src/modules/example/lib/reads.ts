import { sql } from "drizzle-orm";

import { db } from "@/db";

export async function getDatabaseName(): Promise<string> {
  const result = await db.execute<{ name: string }>(
    sql`select current_database() as name`,
  );
  return result.rows[0].name;
}
