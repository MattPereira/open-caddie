import { describe, expect, it } from "vitest";

import { findMigrationDrift } from "./migration-drift";

const repo = [
  { tag: "0000_first", when: 1000, hash: "aaa" },
  { tag: "0001_second", when: 2000, hash: "bbb" },
];

describe("findMigrationDrift", () => {
  it("names an applied migration whose file was edited", () => {
    const applied = [
      { createdAt: 1000, hash: "aaa" },
      { createdAt: 2000, hash: "edited" },
    ];

    expect(findMigrationDrift(applied, repo)).toEqual([
      { kind: "edited", tag: "0001_second" },
    ]);
  });

  it("names an applied migration the repo no longer has by its timestamp", () => {
    const applied = [
      { createdAt: 1000, hash: "aaa" },
      { createdAt: 1500, hash: "gone" },
      { createdAt: 2000, hash: "bbb" },
    ];

    expect(findMigrationDrift(applied, repo)).toEqual([
      { kind: "missing", createdAt: 1500 },
    ]);
  });

  it("names a pending migration older than the newest applied one, which drizzle would skip", () => {
    const applied = [
      { createdAt: 1000, hash: "aaa" },
      { createdAt: 2000, hash: "bbb" },
    ];
    const withLateMerge = [
      ...repo,
      { tag: "0002_generated_earlier", when: 1500, hash: "ccc" },
      { tag: "0003_pending", when: 3000, hash: "ddd" },
    ];

    expect(findMigrationDrift(applied, withLateMerge)).toEqual([
      { kind: "skipped", tag: "0002_generated_earlier" },
    ]);
  });

  it("accepts a migration marked as applied by hand with a baseline hash", () => {
    const applied = [{ createdAt: 1000, hash: "baseline:0000_first" }];

    expect(findMigrationDrift(applied, repo)).toEqual([]);
  });

  it("finds nothing when every applied migration matches the repo", () => {
    const applied = [{ createdAt: 1000, hash: "aaa" }];

    expect(findMigrationDrift(applied, repo)).toEqual([]);
  });
});
