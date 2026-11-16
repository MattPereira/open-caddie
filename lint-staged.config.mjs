// Globs run in parallel; tasks under one glob run in order. File-editing tasks
// share one glob so they never race on a file. Each read-only check gets its
// own glob, and project-wide checks are functions that ignore the file list, so
// they check the whole project instead of receiving file arguments.
// lint-staged hides unstaged changes first, so checks see only staged content.

const quote = (files) => files.map((file) => JSON.stringify(file)).join(" ");

const EDITABLE_CODE = "*.{js,mjs,cjs,ts,tsx}";

const config = {
  [EDITABLE_CODE]: [
    "node scripts/check-file-tokens.mjs",
    "oxlint --fix --no-error-on-unmatched-pattern",
    "oxfmt --no-error-on-unmatched-pattern",
  ],
  [`!(${EDITABLE_CODE})`]: "oxfmt --no-error-on-unmatched-pattern",

  // JSON included for tsconfig.json, package.json and imported JSON.
  "*.{ts,tsx,mts,cts,js,mjs,cjs,json}": () => [
    "next typegen",
    "node node_modules/typescript-7/bin/tsc --noEmit",
  ],
  "{src/**,.dependency-cruiser.cjs,tsconfig.json}": () =>
    "depcruise --cache --cache-strategy content src",
  "{src/**,.dependency-cruiser*.cjs,tsconfig.json}": () =>
    "depcruise --config .dependency-cruiser.runtime.cjs src/modules/*/index.ts",

  // DB tests need Postgres, so only the unit project runs here.
  "*.{ts,tsx}": (files) =>
    `vitest related --run --project unit --passWithNoTests ${quote(files)}`,
};

export default config;
