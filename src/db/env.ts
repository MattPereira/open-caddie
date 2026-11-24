import { config } from "dotenv";

// For database CLIs (drizzle-kit, the seed, the migration check), not the app.
// Variables already set win over both files: the Vercel build sets
// DATABASE_URL itself. .env.development.local holds the local database;
// .env.local is `vercel env pull`'s and may still carry a Neon URL.
export function loadDatabaseUrl() {
  config({ path: [".env.development.local", ".env.local"], quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (.env.development.local)");
  }
  return url;
}
