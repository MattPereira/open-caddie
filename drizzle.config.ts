import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// The local database in .env.development.local wins over any Neon URL that
// `vercel env pull` left in .env.local.
config({ path: [".env.development.local", ".env.local"], quiet: true });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (.env.development.local)");

export default defineConfig({
  out: "./src/db/migrations",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
