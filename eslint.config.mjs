import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".vercel/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees are full copies of the repo, and ESLint doesn't read
    // .gitignore. Also excluded in tsconfig.json and vitest.config.ts.
    ".sandcastle/worktrees/**",
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
