import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { configDefaults, defineConfig } from "vitest/config";

// Loaded here, before any worker imports `@/db`, so suites can import it
// statically. Vars already set (CI) win over the file.
const fileEnv: Record<string, string> = {};
loadEnv({ path: ".env.test", processEnv: fileEnv, quiet: true });
const env = { ...fileEnv, ...definedEnv() };

function definedEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

const DB_TESTS = "**/*.db.test.ts";
// Claude Code worktrees and interrupted Stryker runs leave full copies of the
// tree inside the repo. Without this every test file runs once per copy on top
// of the real one, and the extra db tests exhaust Postgres connections.
const EXCLUDE = [
  ...configDefaults.exclude,
  ".claude/worktrees/**",
  ".stryker-tmp/**",
];

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src/", import.meta.url)) },
  },
  test: {
    exclude: EXCLUDE,
    // next-auth imports `next/server` without an extension, which Node's ESM
    // resolver rejects; inlining lets Vite resolve it.
    server: { deps: { inline: ["next-auth"] } },
    coverage: {
      include: [
        "src/**/*.{ts,tsx}",
        "scripts/seed/**/*.ts",
        "scripts/dev/**/*.ts",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          env,
          setupFiles: ["./src/test/setup.ts"],
          exclude: [...EXCLUDE, DB_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: [DB_TESTS],
          env: {
            ...env,
            ...(env.TEST_DATABASE_URL && {
              DATABASE_URL: env.TEST_DATABASE_URL,
            }),
            DATABASE_DRIVER: "node-postgres",
          },
          globalSetup: ["./src/test/db/global-setup.ts"],
          setupFiles: ["./src/test/setup.ts", "./src/test/db/setup.ts"],
        },
      },
    ],
  },
});
