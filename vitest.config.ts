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
// Claude Code checks out worktrees inside the repo, each a
// full copy of the tree. Without this they are globbed as ordinary
// sources and every test file runs once per worktree on top of the real
// one.
const EXCLUDE = [...configDefaults.exclude, ".claude/worktrees/**"];

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src/", import.meta.url)) },
  },
  test: {
    exclude: EXCLUDE,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          env,
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
          globalSetup: ["./src/test/db-global-setup.ts"],
          setupFiles: ["./src/test/db-setup.ts"],
        },
      },
    ],
  },
});
