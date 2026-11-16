// @ts-check
// Basic setup; follow-ups (diff-scoped runs, db tests, thresholds) are tracked
// in a GitHub issue. Run: pnpm test:mutation <file-or-glob>
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: "pnpm",
  testRunner: "vitest",
  // pnpm's isolated node_modules hides the runner from auto-discovery.
  plugins: ["@stryker-mutator/vitest-runner"],
  vitest: {
    configFile: "vitest.mutation.config.ts",
    // The runner's "related" search goes through Vite's import graph, which
    // can miss tests behind the `@` alias and conclude there are none.
    related: false,
  },
  reporters: ["clear-text", "progress", "html"],
  // "perTest"/"all" rely on the same related search. "off" runs the unit
  // suite for every mutant: slower per mutant, but reliable.
  coverageAnalysis: "off",
  // Always pass the target via `--mutate`; mutating everything is too slow.
  mutate: [],
  ignorePatterns: [
    // Never needed by the sandbox. .vercel holds symlinked dirs, which the
    // sandbox copy fails on with EISDIR.
    ".claude/**",
    ".agents/**",
    "coverage/**",
    ".vercel/**",
    ".next/**",
    "evals/**/runs/**",
  ],
  tempDirName: ".stryker-tmp",
};

export default config;
