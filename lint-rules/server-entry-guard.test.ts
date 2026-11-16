import { beforeAll, describe, expect, it } from "vitest";

import { lintFixtures, type Diagnostic } from "./lint-fixtures";
import { required } from "../src/lib/required";

const RULE = "local/server-entry-guard";

const EXPORT = 'export { a } from "./lib/reads";\n';

const FIXTURES = {
  "src/modules/rounds/server.ts": `import "server-only";\n\n${EXPORT}`,
  "src/modules/clubs/server.ts": EXPORT,
  "src/modules/courses/server.ts": `${EXPORT}import "server-only";\n`,
  "src/modules/matches/server.ts":
    'import x from "server-only";\nexport { x };\n',
  "src/modules/players/server.ts": "",
  "src/modules/rounds/index.ts": EXPORT,
  "src/app/server.ts": EXPORT,
};

let results: Map<string, Diagnostic[]>;
beforeAll(async () => {
  results = await lintFixtures(FIXTURES);
}, 30_000);

const hits = (path: keyof typeof FIXTURES) =>
  required(results.get(path), path).filter((d) => d.rule === RULE);

describe("server-entry-guard lint rule", () => {
  it.each([
    "src/modules/clubs/server.ts",
    "src/modules/courses/server.ts",
    "src/modules/matches/server.ts",
    "src/modules/players/server.ts",
  ] as const)("rejects %s", (path) => {
    expect(hits(path)).toHaveLength(1);
    expect(hits(path)[0].message).toMatch(/server-only/);
  });

  it.each([
    "src/modules/rounds/server.ts",
    "src/modules/rounds/index.ts",
    "src/app/server.ts",
  ] as const)("allows %s", (path) => {
    expect(hits(path)).toEqual([]);
  });
});
