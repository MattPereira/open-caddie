import { beforeAll, describe, expect, it } from "vitest";

import { lintFixtures, type Diagnostic } from "./lint-fixtures";
import { required } from "../src/lib/required";

const RULE = "local/use-server-only-in-actions";

const USE_SERVER = '"use server";\nexport async function a() {}\n';

const FIXTURES = {
  "src/modules/rounds/actions.ts": USE_SERVER,
  "src/modules/rounds/inline.ts":
    'export async function a() {\n  "use server";\n}\n',
  "src/app/(app)/rounds/_lib/writes.ts": USE_SERVER,
  "src/app/(app)/rounds/page.tsx":
    'export default function P() {\n  async function a() {\n    "use server";\n  }\n  return a;\n}\n',
  "src/lib/writes.ts": USE_SERVER,
  "src/modules/rounds/client.tsx":
    '"use client";\nexport const A = () => null;\n',
  "src/modules/rounds/string.ts": 'export const s = "use server";\n',
  "src/app/(app)/rounds/actions.ts": USE_SERVER,
};

let results: Map<string, Diagnostic[]>;
beforeAll(async () => {
  results = await lintFixtures(FIXTURES);
}, 30_000);

const hits = (path: keyof typeof FIXTURES) =>
  required(results.get(path), path).filter((d) => d.rule === RULE);

describe("use-server-only-in-actions lint rule", () => {
  it.each([
    "src/modules/rounds/actions.ts",
    "src/modules/rounds/inline.ts",
    "src/app/(app)/rounds/_lib/writes.ts",
    "src/app/(app)/rounds/page.tsx",
    "src/lib/writes.ts",
  ] as const)("rejects a use server directive in %s", (path) => {
    expect(hits(path)).toHaveLength(1);
    expect(hits(path)[0].message).toMatch(/route actions\.ts/);
  });

  it.each([
    "src/modules/rounds/client.tsx",
    "src/modules/rounds/string.ts",
    "src/app/(app)/rounds/actions.ts",
  ] as const)("allows %s", (path) => {
    expect(hits(path)).toEqual([]);
  });
});
