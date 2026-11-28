import { describe, expect, it } from "vitest";

import {
  isTestRunDatabase,
  runDatabaseName,
  templateName,
  workerName,
} from "./databases";

describe("test run databases", () => {
  it("keeps overlapping invocations outside each other's cleanup", () => {
    const shared = { TEST_DATABASE_URL: "postgresql:///open_caddie_test" };
    const first = runDatabaseName({
      ...shared,
      TEST_DATABASE_RUN_ID: "11111111111111111111111111111111",
    });
    const second = runDatabaseName({
      ...shared,
      TEST_DATABASE_RUN_ID: "22222222222222222222222222222222",
    });

    expect(isTestRunDatabase(first, templateName(second))).toBe(false);
    expect(isTestRunDatabase(first, workerName(second, "1"))).toBe(false);
    expect(isTestRunDatabase(first, templateName(first))).toBe(true);
    expect(isTestRunDatabase(first, workerName(first, "1"))).toBe(true);
    expect(isTestRunDatabase(second, workerName(first, "1"))).toBe(false);
  });

  it.each([
    undefined,
    "",
    "all",
    "a".repeat(31),
    "a".repeat(33),
    "A".repeat(32),
    "11111111111111111111111111111111_w1",
  ])("rejects an unsafe or missing run ID: %s", (id) => {
    expect(() => runDatabaseName({ TEST_DATABASE_RUN_ID: id })).toThrow(
      "TEST_DATABASE_RUN_ID must be 32 lowercase hexadecimal characters",
    );
  });

  it("keeps database identifiers within PostgreSQL's limit for long base names", () => {
    const run = runDatabaseName({
      TEST_DATABASE_URL: `postgresql:///${"測".repeat(21)}`,
      TEST_DATABASE_RUN_ID: "0123456789abcdef0123456789abcdef",
    });
    expect(Buffer.byteLength(templateName(run))).toBeLessThanOrEqual(63);
    expect(Buffer.byteLength(workerName(run, "999999"))).toBeLessThanOrEqual(
      63,
    );
  });

  it("excludes the maintenance database and similar names from cleanup", () => {
    const run = runDatabaseName({
      TEST_DATABASE_RUN_ID: "0123456789abcdef0123456789abcdef",
    });
    for (const name of [
      "open_caddie_test",
      run,
      `${run}_template_backup`,
      `${run}_w1_backup`,
      `${run}_w`,
      `${run}_w-1`,
    ]) {
      expect(isTestRunDatabase(run, name)).toBe(false);
    }
  });
});
