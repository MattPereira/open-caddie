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
  {
    // Every export of a "use server" file is a public endpoint. Module writes
    // take the acting Player's id, so as endpoints a client could pass any id
    // and bypass authorization. Only route actions.ts files are "use server".
    files: ["src/modules/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExpressionStatement[directive='use server']",
          message:
            'Modules are never "use server": wrap the write in a route actions.ts that reads the session.',
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".vercel/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    // Agent worktrees are full copies of the repo, and ESLint doesn't read
    // .gitignore. Also excluded in tsconfig.json and vitest.config.ts.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
