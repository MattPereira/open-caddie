import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Creating a client never connects, so none of these touch a database.
async function importDb(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("@/db");
}

describe("database module under vitest", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DATABASE_LOCAL_SOCKET", undefined);
    vi.stubEnv("DATABASE_DRIVER", undefined);
    vi.stubEnv("PGHOST", undefined);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("refuses a Neon host, naming it", async () => {
    await expect(
      importDb({
        DATABASE_URL:
          "postgresql://owner:secret@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require",
      }),
    ).rejects.toThrow("ep-cool-name-123456.us-east-2.aws.neon.tech");
  });

  it("refuses a non-local host on the node-postgres driver", async () => {
    await expect(
      importDb({
        DATABASE_DRIVER: "node-postgres",
        DATABASE_URL: "postgres://u:p@db.example.com:5432/app",
      }),
    ).rejects.toThrow("db.example.com");
  });

  it.each([
    "postgres://u:p@localhost:5432/app",
    "postgres://u:p@127.0.0.1:5432/app",
    "postgres://u:p@[::1]:5432/app",
    "postgresql://u@%2Fvar%2Frun%2Fpostgresql/app",
    "postgresql:///app?host=/var/run/postgresql",
  ])("accepts local %s", async (url) => {
    const { db } = await importDb({
      DATABASE_DRIVER: "node-postgres",
      DATABASE_URL: url,
    });
    expect(db).toBeDefined();
  });

  it("refuses an empty host when PGHOST is non-local, naming it", async () => {
    await expect(
      importDb({
        DATABASE_DRIVER: "node-postgres",
        DATABASE_URL: "postgresql:///app",
        PGHOST: "db.example.com",
      }),
    ).rejects.toThrow("db.example.com");
  });

  it.each([undefined, "localhost", "/var/run/postgresql"])(
    "accepts an empty host when PGHOST is %s",
    async (pghost) => {
      const { db } = await importDb({
        DATABASE_DRIVER: "node-postgres",
        DATABASE_URL: "postgresql:///app",
        PGHOST: pghost,
      });
      expect(db).toBeDefined();
    },
  );

  it("accepts the local-socket env even when the URL is remote", async () => {
    const { db } = await importDb({
      DATABASE_DRIVER: "node-postgres",
      DATABASE_LOCAL_SOCKET: "/var/run/postgresql",
      DATABASE_URL: "postgres://u:p@db.example.com:5432/app",
    });
    expect(db).toBeDefined();
  });

  it("refuses a non-socket value in the local-socket env", async () => {
    await expect(
      importDb({
        DATABASE_DRIVER: "node-postgres",
        DATABASE_LOCAL_SOCKET: "db.example.com",
        DATABASE_URL: "postgres://u:p@localhost:5432/app",
      }),
    ).rejects.toThrow("db.example.com");
  });

  it("does not guard outside vitest", async () => {
    const { db } = await importDb({
      VITEST: undefined,
      DATABASE_URL:
        "postgresql://owner:secret@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb",
    });
    expect(db).toBeDefined();
  });
});
