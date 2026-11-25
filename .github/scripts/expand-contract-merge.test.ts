import { describe, expect, it } from "vitest";
import {
  type MergeInputs,
  mergeDecision,
  migrationDrops,
  pullsToUpdate,
} from "./expand-contract";

const clean: MergeInputs = {
  closesStep: true,
  call: { call: "auto", reason: "Both axes pass; nothing left." },
  findingsLeft: 0,
  drops: [],
};

describe("mergeDecision", () => {
  it("auto-merges a clean step", () => {
    expect(mergeDecision(clean)).toEqual({ action: "auto-merge" });
  });

  it("leaves a PR that closes no step alone, whatever the review said", () => {
    expect(
      mergeDecision({
        closesStep: false,
        call: { call: "needs-a-human", reason: "A product decision." },
        findingsLeft: 2,
        drops: ["src/db/migrations/0024_drop.sql"],
      }),
    ).toEqual({ action: "none" });
  });

  it("hands a step to a human when the reviewer calls it, with the reviewer's reason", () => {
    expect(
      mergeDecision({
        ...clean,
        call: { call: "needs-a-human", reason: "The backfill is unbounded." },
      }),
    ).toEqual({
      action: "needs-a-human",
      reasons: ["The reviewer's call: The backfill is unbounded."],
    });
  });

  it("hands a step to a human when the review left a finding, even on an auto call", () => {
    expect(mergeDecision({ ...clean, findingsLeft: 1 })).toEqual({
      action: "needs-a-human",
      reasons: ["The review left 1 finding for you."],
    });
  });

  it("counts every finding left", () => {
    expect(mergeDecision({ ...clean, findingsLeft: 3 })).toEqual({
      action: "needs-a-human",
      reasons: ["The review left 3 findings for you."],
    });
  });

  it("hands a step to a human when a migration drops something", () => {
    expect(
      mergeDecision({ ...clean, drops: ["src/db/migrations/0024_drop.sql"] }),
    ).toEqual({
      action: "needs-a-human",
      reasons: [
        "`src/db/migrations/0024_drop.sql` contains `DROP`, which can't be rolled back (#270).",
      ],
    });
  });

  it("gives every reason at once", () => {
    expect(
      mergeDecision({
        ...clean,
        call: { call: "needs-a-human", reason: "Unsure." },
        findingsLeft: 1,
        drops: ["a.sql", "b.sql"],
      }),
    ).toMatchObject({ action: "needs-a-human", reasons: { length: 4 } });
  });
});

const fileDiff = (file: string, lines: string[]) =>
  [
    `diff --git a/${file} b/${file}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${file}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines,
  ].join("\n");

describe("migrationDrops", () => {
  it("names a migration that adds a DROP", () => {
    const diff = [
      fileDiff("src/db/migrations/0023_add.sql", [
        '+ALTER TABLE "users" ADD COLUMN "x" text;',
      ]),
      fileDiff("src/db/migrations/0024_contract.sql", [
        '+ALTER TABLE "users" DROP COLUMN "is_admin";',
      ]),
    ].join("\n");
    expect(migrationDrops(diff)).toEqual([
      "src/db/migrations/0024_contract.sql",
    ]);
  });

  it("ignores DROP outside a migration, and a DROP the diff removes", () => {
    const diff = [
      fileDiff("src/db/schema.ts", ["+// DROP isAdmin in the contract step"]),
      [
        "diff --git a/src/db/migrations/0020_x.sql b/src/db/migrations/0020_x.sql",
        "--- a/src/db/migrations/0020_x.sql",
        "+++ b/src/db/migrations/0020_x.sql",
        "@@ -1 +1 @@",
        '-DROP TABLE "old";',
        "+SELECT 1;",
      ].join("\n"),
    ].join("\n");
    expect(migrationDrops(diff)).toEqual([]);
  });

  it("catches a lower-case drop", () => {
    const diff = fileDiff("src/db/migrations/0024_x.sql", [
      '+alter table "users" drop column "is_admin";',
    ]);
    expect(migrationDrops(diff)).toEqual(["src/db/migrations/0024_x.sql"]);
  });
});

describe("pullsToUpdate", () => {
  it("updates only the open step PRs with auto-merge on, each once", () => {
    const steps = [
      {
        closingPulls: [
          { number: 280, autoMerge: true },
          { number: 281, autoMerge: false },
        ],
      },
      { closingPulls: [{ number: 280, autoMerge: true }] },
      { closingPulls: [] },
    ];
    expect(pullsToUpdate(steps)).toEqual([280]);
  });
});
