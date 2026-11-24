import { describe, expect, it } from "vitest";

import { findBreakingStatements } from "./breaking-statements";

describe("findBreakingStatements", () => {
  it("flags a generated column drop", () => {
    const sql = `ALTER TABLE "user" DROP COLUMN "isAdmin";`;

    expect(findBreakingStatements(sql)).toEqual([
      {
        kind: "drop-column",
        statement: `ALTER TABLE "user" DROP COLUMN "isAdmin"`,
      },
    ]);
  });

  it.each([
    [
      "rename",
      `ALTER TABLE "user" RENAME COLUMN "isAdmin" TO "isPlatformAdmin"`,
    ],
    ["rename", `ALTER TABLE "scrambles" RENAME TO "team_games"`],
    [
      "change-type",
      `ALTER TABLE "rounds" ALTER COLUMN "score" SET DATA TYPE integer`,
    ],
    ["change-type", `ALTER TABLE "rounds" ALTER COLUMN "score" TYPE integer`],
    ["set-not-null", `ALTER TABLE "rounds" ALTER COLUMN "tee_id" SET NOT NULL`],
    [
      "drop-default",
      `ALTER TABLE "clubs" ALTER COLUMN "point_rules" DROP DEFAULT`,
    ],
  ])("flags %s: %s", (kind, statement) => {
    expect(findBreakingStatements(`${statement};`)).toEqual([
      { kind, statement },
    ]);
  });

  it("passes statements the deployed code survives", () => {
    const sql = [
      `ALTER TABLE "user" ADD COLUMN "isPlatformAdmin" boolean DEFAULT false NOT NULL;--> statement-breakpoint`,
      `UPDATE "user" SET "isPlatformAdmin" = "isAdmin";--> statement-breakpoint`,
      `CREATE UNIQUE INDEX "user_email" ON "user" ("email");--> statement-breakpoint`,
      `ALTER TABLE "rounds" ALTER COLUMN "tee_id" DROP NOT NULL;--> statement-breakpoint`,
      `DROP INDEX "course_tees_id_course_unique";--> statement-breakpoint`,
      `SELECT 1;`,
    ].join("\n");

    expect(findBreakingStatements(sql)).toEqual([]);
  });

  it("lets a deploy-safe reason clear only the statement below it", () => {
    const sql = [
      `-- deploy-safe: contract of #95; switch deployed`,
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "isAdmin";--> statement-breakpoint`,
      `DROP TABLE "scrambles" CASCADE;`,
    ].join("\n");

    expect(findBreakingStatements(sql)).toEqual([
      { kind: "drop-table", statement: `DROP TABLE "scrambles" CASCADE` },
    ]);
  });

  it("reads a hand-written statement across lines, with no final semicolon", () => {
    const sql = [
      `-- Custom SQL migration file, put your code below! --`,
      `ALTER TABLE "user"`,
      `  DROP COLUMN "isAdmin"`,
    ].join("\n");

    expect(findBreakingStatements(sql)).toEqual([
      {
        kind: "drop-column",
        statement: `ALTER TABLE "user" DROP COLUMN "isAdmin"`,
      },
    ]);
  });

  it("ignores breaking words inside comments", () => {
    const sql = [
      `-- once the switch deploys, DROP COLUMN "isAdmin"`,
      `UPDATE "user" SET "isPlatformAdmin" = "isAdmin"; -- RENAME later`,
    ].join("\n");

    expect(findBreakingStatements(sql)).toEqual([]);
  });

  it("accepts a loosely spaced deploy-safe reason", () => {
    const sql = [
      `  --deploy-safe:no live insert omits point_rules`,
      `ALTER TABLE "clubs" ALTER COLUMN "point_rules" DROP DEFAULT;`,
    ].join("\n");

    expect(findBreakingStatements(sql)).toEqual([]);
  });

  it.each([
    ["an empty reason", [`-- deploy-safe:`, `DROP TABLE "scrambles";`]],
    [
      "a reason after the statement",
      [`DROP TABLE "scrambles"; -- deploy-safe: x`],
    ],
  ])("keeps flagging with %s", (_, lines) => {
    expect(findBreakingStatements(lines.join("\n"))).toEqual([
      { kind: "drop-table", statement: `DROP TABLE "scrambles"` },
    ]);
  });
});
