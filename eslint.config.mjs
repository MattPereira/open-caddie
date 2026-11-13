import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

import playerDomainTerm from "./eslint-rules/player-domain-term.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { local: playerDomainTerm },
    rules: { "local/player-domain-term": "error" },
  },
  {
    // Sign-in side of ADR 0007: Auth.js config, session types, sign-in links
    // and the login flow keep User naming.
    files: [
      "src/auth.ts",
      "src/auth.types.d.ts",
      "src/lib/auth/**",
      "src/app/(app)/login/**",
      "src/app/api/auth/**",
    ],
    rules: { "local/player-domain-term": "off" },
  },
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
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
