import { sql } from "drizzle-orm";

import { db } from "@/db";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Runs `body` in a transaction on its own connection and keeps it open,
// holding its locks, until release() is called.
export async function holdTransaction(body: (tx: Tx) => Promise<unknown>) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let ready!: () => void;
  const started = new Promise<void>((resolve) => (ready = resolve));
  const done = db.transaction(async (tx) => {
    await body(tx);
    ready();
    await gate;
  });
  await Promise.race([started, done]);
  return { release, done };
}

// Waits until `count` queries touching `table` are queued behind a lock.
export async function waitForLockWaits(table: string, count: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const { rows } = await db.execute<{ waiting: number }>(sql`
      select count(*)::int as waiting from pg_stat_activity
      where datname = current_database()
        and wait_event_type = 'Lock'
        and query ilike ${`%${table}%`}`);
    if (rows[0].waiting >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Expected ${count} queries on ${table} waiting on a lock.`);
}

/** Takes `table`'s FOR UPDATE row lock on `id`, as an edit of that row does. */
export async function lockRow(tx: Tx, table: string, id: number) {
  await tx.execute(
    sql`select id from ${sql.identifier(table)} where id = ${id} for update`,
  );
}

/** Takes FOR UPDATE row locks on `table`'s rows matching every `key` column. */
export async function lockRowsWhere(
  tx: Tx,
  table: string,
  key: Record<string, number>,
) {
  const where = sql.join(
    Object.entries(key).map(
      ([column, value]) => sql`${sql.identifier(column)} = ${value}`,
    ),
    sql` and `,
  );
  await tx.execute(
    sql`select 1 from ${sql.identifier(table)} where ${where} for update`,
  );
}
