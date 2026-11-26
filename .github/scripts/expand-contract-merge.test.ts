import { describe, expect, it } from "vitest";
import {
  type CheckContext,
  checksVerdict,
  type MergeInputs,
  type MergeOps,
  mergeDecision,
  mergeWhenGreen,
  migrationDrops,
} from "./expand-contract-merge";

const clean: MergeInputs = {
  closesStep: true,
  call: { call: "auto", reason: "Both axes pass; nothing left." },
  findingsLeft: 0,
  drops: [],
};

describe("mergeDecision", () => {
  it("merges a clean step", () => {
    expect(mergeDecision(clean)).toEqual({ action: "merge" });
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

const required = (state: CheckContext["state"]): CheckContext => ({
  required: true,
  state,
});

describe("checksVerdict", () => {
  it("passes once every required check passed, whatever the others say", () => {
    expect(
      checksVerdict([
        required("pass"),
        required("pass"),
        { required: false, state: "fail" },
      ]),
    ).toBe("passed");
  });

  it("waits while a required check runs", () => {
    expect(checksVerdict([required("pass"), required("pending")])).toBe(
      "pending",
    );
  });

  it("waits while no required check has reported yet", () => {
    expect(checksVerdict([{ required: false, state: "pass" }])).toBe("pending");
  });

  it("fails on a failed required check, even while another runs", () => {
    expect(checksVerdict([required("pending"), required("fail")])).toBe(
      "failed",
    );
  });
});

interface FakePull {
  head: string;
  behind: boolean;
  checks: "passed" | "failed" | "timed-out";
  /** How many merges main moves under, refusing them. */
  mainMoves: number;
}

function fakeOps(pull: FakePull) {
  const merged: string[] = [];
  let updates = 0;
  const ops: MergeOps = {
    head: async () => ({ sha: pull.head, behind: pull.behind }),
    updateBranch: async () => {
      updates++;
      pull.head = `${pull.head}+main`;
      pull.behind = false;
      return pull.head;
    },
    waitForChecks: async () => pull.checks,
    merge: async (sha) => {
      if (pull.mainMoves > 0) {
        pull.mainMoves--;
        pull.behind = true;
        return false;
      }
      merged.push(sha);
      return true;
    },
  };
  return { ops, merged, updates: () => updates };
}

const reviewed = (overrides: Partial<FakePull> = {}): FakePull => ({
  head: "reviewed",
  behind: false,
  checks: "passed",
  mainMoves: 0,
  ...overrides,
});

describe("mergeWhenGreen", () => {
  it("merges the reviewed commit once its checks pass", async () => {
    const { ops, merged } = fakeOps(reviewed());
    expect(await mergeWhenGreen("reviewed", ops)).toEqual({ merged: true });
    expect(merged).toEqual(["reviewed"]);
  });

  it("updates a branch that is behind main, then merges the update", async () => {
    const { ops, merged } = fakeOps(reviewed({ behind: true }));
    expect(await mergeWhenGreen("reviewed", ops)).toEqual({ merged: true });
    expect(merged).toEqual(["reviewed+main"]);
  });

  it("updates again when main moves during the wait", async () => {
    const { ops, merged, updates } = fakeOps(reviewed({ mainMoves: 1 }));
    expect(await mergeWhenGreen("reviewed", ops)).toEqual({ merged: true });
    expect(updates()).toBe(1);
    expect(merged).toEqual(["reviewed+main"]);
  });

  it("gives up after three attempts", async () => {
    const { ops, merged } = fakeOps(reviewed({ mainMoves: 3 }));
    expect(await mergeWhenGreen("reviewed", ops)).toEqual({
      merged: false,
      reason: "Main moved under 3 merge attempts.",
    });
    expect(merged).toEqual([]);
  });

  it("refuses a branch someone pushed to after the review", async () => {
    const { ops, merged } = fakeOps(reviewed({ head: "someone-else" }));
    expect(await mergeWhenGreen("reviewed", ops)).toEqual({
      merged: false,
      reason: "`someone` was pushed after the review.",
    });
    expect(merged).toEqual([]);
  });

  it("stops on a failed required check", async () => {
    const { ops, merged } = fakeOps(reviewed({ checks: "failed" }));
    expect(await mergeWhenGreen("reviewed", ops)).toEqual({
      merged: false,
      reason: "A required check failed.",
    });
    expect(merged).toEqual([]);
  });

  it("stops when the checks outlast the wait", async () => {
    const { ops } = fakeOps(reviewed({ checks: "timed-out" }));
    expect(await mergeWhenGreen("reviewed", ops)).toEqual({
      merged: false,
      reason: "The required checks did not finish within 30 minutes.",
    });
  });
});
