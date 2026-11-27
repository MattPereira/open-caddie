import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const run = promisify(execFile);
const ROOT = process.cwd();

type Violation = {
  rule: { name: string };
  from: string;
  to: string;
  via?: { name: string }[];
};

const DB = "export const db = { query: () => [] };\n";
const SERVER_ENTRY =
  'import "server-only";\nexport const getRounds = () => [];\n';

// Each client component sits at the head of its own chain, so a violation
// names exactly one fixture.
const FIXTURES = {
  "src/db/index.ts": DB,
  "src/db/schema.ts": "export type Round = { id: string };\n",
  "src/modules/rounds/server.ts": SERVER_ENTRY,
  "src/modules/rounds/index.ts": "export const par = 72;\n",
  "src/modules/clubs/index.ts":
    'import { load } from "@/lib/db-helper";\nexport const clubs = () => load();\n',
  "src/lib/db-helper.ts":
    'import { db } from "@/db";\nexport const load = () => db.query();\n',
  "src/lib/server-entry-helper.ts":
    'import { getRounds } from "@/modules/rounds/server";\nexport const load = () => getRounds();\n',
  "src/lib/pure-helper.ts": "export const double = (n: number) => n * 2;\n",
  "src/lib/type-helper.ts":
    'import type { Round } from "@/db/schema";\nimport { type getRounds } from "@/modules/rounds/server";\nexport type Rounds = ReturnType<typeof getRounds> & Round[];\n',
  "src/app/rounds/actions.ts":
    '"use server";\nimport "server-only";\nimport { db } from "@/db";\nexport async function save() { db.query(); }\n',

  "src/components/via-db-helper.tsx":
    '"use client";\nimport { load } from "@/lib/db-helper";\nexport const A = () => load();\n',
  "src/app/rounds/via-server-entry-helper.tsx":
    "// A comment may come before the directive.\n'use client'\nimport { load } from \"@/lib/server-entry-helper\";\nexport const B = () => load();\n",
  "src/components/server-only-direct.tsx":
    '"use client";\nimport "server-only";\nexport const C = () => null;\n',
  "src/components/pure.tsx":
    '"use client";\nimport { double } from "@/lib/pure-helper";\nimport { par } from "@/modules/rounds";\nexport const D = () => double(par);\n',
  "src/components/type-only.tsx":
    '"use client";\nimport type { Rounds } from "@/lib/type-helper";\nimport type { getRounds } from "@/modules/rounds/server";\nexport const E = (r: Rounds, g: typeof getRounds) => [r, g];\n',
  "src/components/server-action.tsx":
    '"use client";\nimport { save } from "@/app/rounds/actions";\nexport const F = () => save();\n',
  "src/components/server-component.tsx":
    'import { load } from "@/lib/db-helper";\nimport { getRounds } from "@/modules/rounds/server";\nexport const G = () => [load(), getRounds()];\n',
  "src/components/directive-too-late.tsx":
    'import { load } from "@/lib/db-helper";\n"use client";\nexport const H = () => load();\n',
};

let dir: string;
let violations: Violation[];

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "runtime-boundaries-"));
  for (const file of [
    ".dependency-cruiser.cjs",
    ".dependency-cruiser.runtime.cjs",
    "scripts/directive-files.cjs",
    "tsconfig.json",
  ]) {
    await mkdir(dirname(join(dir, file)), { recursive: true });
    await cp(join(ROOT, file), join(dir, file));
  }
  await symlink(join(ROOT, "node_modules"), join(dir, "node_modules"));
  for (const [path, code] of Object.entries(FIXTURES)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), code);
  }
  const { stdout } = await run(
    join(ROOT, "node_modules/.bin/depcruise"),
    [
      "--config",
      ".dependency-cruiser.runtime.cjs",
      "--output-type",
      "json",
      "src",
    ],
    { cwd: dir },
  ).catch((error: { stdout?: string }) => {
    // Non-zero exit just means violations; the JSON is still on stdout.
    if (error.stdout) return { stdout: error.stdout };
    throw error;
  });
  violations = JSON.parse(stdout).summary.violations;
}, 60_000);

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const clientViolationsFrom = (path: keyof typeof FIXTURES) =>
  violations.filter(
    (v) => v.rule.name === "client-runs-in-browser" && v.from === path,
  );

describe("client-runs-in-browser", () => {
  it("rejects a client component that reaches the db through a helper, naming the chain", () => {
    const [violation, ...rest] = clientViolationsFrom(
      "src/components/via-db-helper.tsx",
    );
    expect(rest).toEqual([]);
    expect(violation.to).toBe("src/db/index.ts");
    expect(violation.via?.map((step) => step.name)).toEqual([
      "src/lib/db-helper.ts",
      "src/db/index.ts",
    ]);
  });

  it("rejects a client component that reaches a module server entry through a helper", () => {
    const tos = clientViolationsFrom(
      "src/app/rounds/via-server-entry-helper.tsx",
    ).map((v) => v.to);
    expect(tos).toContain("src/modules/rounds/server.ts");
  });

  it("rejects a client component that imports server-only", () => {
    const tos = clientViolationsFrom(
      "src/components/server-only-direct.tsx",
    ).map((v) => v.to);
    expect(tos).toEqual([expect.stringMatching(/node_modules\/server-only\//)]);
  });

  it.each([
    "src/components/pure.tsx",
    "src/components/type-only.tsx",
    "src/components/server-action.tsx",
    "src/components/server-component.tsx",
    "src/components/directive-too-late.tsx",
  ] as const)("allows %s", (path) => {
    expect(clientViolationsFrom(path)).toEqual([]);
  });

  it("keeps the index-runs-anywhere check", () => {
    const fromIndex = violations
      .filter((v) => v.rule.name === "index-runs-anywhere")
      .map((v) => [v.from, v.to]);
    expect(fromIndex).toEqual([
      ["src/modules/clubs/index.ts", "src/db/index.ts"],
    ]);
  });
});
