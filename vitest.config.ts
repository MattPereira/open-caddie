import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// The DB-backed suites skip without TEST_DATABASE_URL, which in CI would turn
// a broken DB setup into a silent green run.
if (process.env.CI && !process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must be set in CI");
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src/", import.meta.url)) },
  },
  test: {
    // Sandcastle and Claude Code check out worktrees inside the repo, each a
    // full copy of the tree. Without this they are globbed as ordinary
    // sources and every test file runs once per worktree on top of the real
    // one.
    exclude: [
      ...configDefaults.exclude,
      ".sandcastle/worktrees/**",
      ".claude/worktrees/**",
    ],
  },
});
