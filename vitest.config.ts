import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // Sandcastle checks out worktrees inside the repo, each a full copy of the
    // tree. Without this they are globbed as ordinary sources and every test
    // file runs once per worktree on top of the real one.
    exclude: [...configDefaults.exclude, ".sandcastle/worktrees/**"],
  },
});
