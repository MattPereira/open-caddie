import ws from "ws";
import { Pool } from "pg";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const db =
  process.env.DATABASE_DRIVER === "node-postgres"
    ? drizzleNodePostgres(
        new Pool(
          process.env.DATABASE_LOCAL_SOCKET
            ? {
                host: process.env.DATABASE_LOCAL_SOCKET,
                database: process.env.DATABASE_NAME,
                user: process.env.DATABASE_USER,
              }
            : { connectionString: process.env.DATABASE_URL },
        ),
      )
    : drizzleNeon({
        connection: process.env.DATABASE_URL,
        ws,
      });
