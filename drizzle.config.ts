import { defineConfig } from "drizzle-kit";

import { loadDatabaseUrl } from "./src/db/env";

const url = loadDatabaseUrl();

export default defineConfig({
  out: "./src/db/migrations",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
