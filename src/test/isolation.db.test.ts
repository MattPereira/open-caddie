import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import * as schema from "@/db/schema";

const baseName = new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1);

async function currentDatabase() {
  const { rows } = await db.execute<{ name: string }>(
    sql`select current_database() as name`,
  );
  return rows[0].name;
}

describe("db test isolation", () => {
  it("connects to a worker database, not the template or the configured one", async () => {
    const name = await currentDatabase();
    expect(name).not.toBe(baseName);
    expect(name).not.toBe(`${baseName}_template`);
    expect(name).toMatch(new RegExp(`^${baseName}_w\\d+$`));
  });

  // These two run in order: the second proves the first's row was truncated.
  it("lets a test insert a row", async () => {
    await db
      .insert(schema.courses)
      .values({ handle: "isolation-course", name: "Isolation Course" });
    expect(await db.$count(schema.courses)).toBe(1);
  });

  it("starts the next test with that row gone", async () => {
    expect(await db.$count(schema.courses)).toBe(0);
  });

  it("keeps the migrations table through the truncate", async () => {
    const { rows } = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    expect(rows[0].count).toBeGreaterThan(0);
  });
});
