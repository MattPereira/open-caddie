import { afterEach, beforeEach, describe, expect, it } from "vitest";

// This suite is intentionally opt-in: .env.test must point at a disposable
// local Postgres-compatible database. It exercises only the public import
// interface; direct database access below is fixture setup/cleanup.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  describe.skip("Course Scorecard Import", () => {
    it("requires TEST_DATABASE_URL", () => {});
  });
} else {
describe("Course Scorecard Import", async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const [{ db }, schema, { createCourseScorecardImport }] = await Promise.all([
    import("@/db"),
    import("@/db/schema"),
    import("./index"),
  ]);
  const { eq, like, sql } = await import("drizzle-orm");
  const actorId = crypto.randomUUID();
  const secondActorId = crypto.randomUUID();
  const imports = createCourseScorecardImport({
    async parseScorecardImage() {
      return {
        scorecard: {
          tees: [
            {
              name: "Blue",
              color: "blue",
              rating: 71.2,
              slope: 128,
              yardages: Array.from({ length: 18 }, () => 400),
            },
          ],
          holes: Array.from({ length: 18 }, (_, index) => ({
            hole: index + 1,
            par: 4,
            handicap: index + 1,
          })),
        },
        warnings: [],
      };
    },
  });

  beforeEach(async () => {
    await db.insert(schema.users).values({ id: actorId, isAdmin: true });
    await db.insert(schema.users).values({ id: secondActorId, isAdmin: true });
  });

  afterEach(async () => {
    await db.execute(sql.raw("drop trigger if exists fail_course_holes_insert on course_holes"));
    await db.execute(sql.raw("drop function if exists fail_course_holes_insert()"));
    await db.delete(schema.courseScorecardImports).where(eq(schema.courseScorecardImports.createdByUserId, actorId));
    await db.delete(schema.courses).where(like(schema.courses.name, `%${actorId}%`));
    await db.delete(schema.users).where(eq(schema.users.id, actorId));
    await db.delete(schema.users).where(eq(schema.users.id, secondActorId));
  });

  it("publishes a clean new course", async () => {
    const outcome = await imports.start({
      actorId,
      target: { kind: "new", name: `Test Course ${actorId}` },
      stagedCourseImageHandle: "course-image",
      stagedScorecardImageHandle: "scorecard-image",
    });

    expect(outcome.outcome).toBe("published");
  });

  it("pauses missing tee metadata and publishes after resolution", async () => {
    const missingMetadataImport = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [{ name: "Gold", yardages: Array.from({ length: 18 }, () => 400) }],
            holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })),
          },
          warnings: [],
        };
      },
    });
    const paused = await missingMetadataImport.start({
      actorId,
      target: { kind: "new", name: `Paused Course ${actorId}` },
      stagedScorecardImageHandle: "missing-meta-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const published = await missingMetadataImport.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: { kind: "resolve", teeMetadata: { "tee:0:metadata": { rating: 69.4, slope: 117 } } },
    });
    expect(published.outcome).toBe("published");
  });

  it("allows another administrator to inspect and resolve a paused import", async () => {
    const importsWithMissingMetadata = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [{ name: "White", yardages: Array.from({ length: 18 }, () => 400) }],
            holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })),
          },
          warnings: [],
        };
      },
    });
    const paused = await importsWithMissingMetadata.start({
      actorId,
      target: { kind: "new", name: `Shared Course ${actorId}` },
      stagedScorecardImageHandle: "shared-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const inspected = await importsWithMissingMetadata.inspect({ actorId: secondActorId, importId: paused.import.id });
    expect(inspected.outcome).toBe("paused");
    if (inspected.outcome !== "paused") return;

    const published = await importsWithMissingMetadata.continue({
      actorId: secondActorId,
      importId: inspected.import.id,
      expectedRevision: inspected.import.revision,
      intent: { kind: "resolve", teeMetadata: { "tee:0:metadata": { rating: 68.8, slope: 114 } } },
    });
    expect(published.outcome).toBe("published");
  });

  it("persists partial answers and recomputes only the remaining prompts", async () => {
    const twoMissingTees = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: ["Blue", "White"].map((name) => ({ name, yardages: Array.from({ length: 18 }, () => 400) })),
            holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })),
          },
          warnings: [],
        };
      },
    });
    const paused = await twoMissingTees.start({ actorId, target: { kind: "new", name: `Partial Course ${actorId}` }, stagedScorecardImageHandle: "partial-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const partial = await twoMissingTees.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: { kind: "resolve", teeMetadata: { "tee:0:metadata": { rating: 70, slope: 120 } } },
    });
    expect(partial.outcome).toBe("paused");
    if (partial.outcome !== "paused") return;
    expect(partial.import.revision).toBeGreaterThan(paused.import.revision);
    expect(partial.import.prompts).toContainEqual({ id: "tee:1:metadata", kind: "tee_metadata", teeIndex: 1, teeName: "White" });

    const published = await twoMissingTees.continue({ actorId, importId: partial.import.id, expectedRevision: partial.import.revision, intent: { kind: "resolve", teeMetadata: { "tee:1:metadata": { rating: 69, slope: 116 } } } });
    expect(published.outcome).toBe("published");
  });

  it("invalidates warning acknowledgement after a correction", async () => {
    const warningImport = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: { tees: [{ name: "Blue", rating: 71, slope: 125, yardages: Array.from({ length: 18 }, () => 400) }], holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })) },
          warnings: ["Blue total does not match the card"],
        };
      },
    });
    const paused = await warningImport.start({ actorId, target: { kind: "new", name: `Warning Course ${actorId}` }, stagedScorecardImageHandle: "warning-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const corrected = await warningImport.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "resolve", acknowledgeWarnings: ["warning:0"], corrections: { tees: { "tee:0": { name: "Blue Championship" } } } } });
    expect(corrected.outcome).toBe("paused");
    if (corrected.outcome !== "paused") return;
    expect(corrected.import.prompts).toContainEqual({ id: "warning:0", kind: "warning_acknowledgement", warning: "Blue total does not match the card" });

    const published = await warningImport.continue({ actorId, importId: corrected.import.id, expectedRevision: corrected.import.revision, intent: { kind: "resolve", acknowledgeWarnings: ["warning:0"] } });
    expect(published.outcome).toBe("published");
  });

  it("allows an administrator to exclude an erroneous parsed tee", async () => {
    const importWithBadTee = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              { name: "Blue", rating: 71, slope: 125, yardages: Array.from({ length: 18 }, () => 400) },
              { name: "Parser Error", rating: 71, slope: 125, yardages: Array.from({ length: 18 }, () => 0) },
            ],
            holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })),
          },
          warnings: [],
        };
      },
    });
    const paused = await importWithBadTee.start({ actorId, target: { kind: "new", name: `Excluded Course ${actorId}` }, stagedScorecardImageHandle: "excluded-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    expect(paused.import.parsed.tees[1]).toMatchObject({ id: "tee:1", excluded: false });

    const published = await importWithBadTee.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "resolve", excludeTees: ["tee:1"] } });
    expect(published.outcome).toBe("published");
  });

  it("rolls back every live-course write when publication fails", async () => {
    const importWithMissingMetadata = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: { tees: [{ name: "Blue", yardages: Array.from({ length: 18 }, () => 400) }], holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })) },
          warnings: [],
        };
      },
    });
    const name = `Rollback Course ${actorId}`;
    const paused = await importWithMissingMetadata.start({ actorId, target: { kind: "new", name }, stagedScorecardImageHandle: "rollback-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    await db.execute(sql.raw("create function fail_course_holes_insert() returns trigger language plpgsql as $$ begin raise exception 'forced publication failure'; end; $$"));
    await db.execute(sql.raw("create trigger fail_course_holes_insert before insert on course_holes for each row execute function fail_course_holes_insert()"));
    await expect(importWithMissingMetadata.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "resolve", teeMetadata: { "tee:0:metadata": { rating: 71, slope: 125 } } } })).rejects.toThrow();

    const liveCourses = await db.select().from(schema.courses).where(eq(schema.courses.name, name));
    expect(liveCourses).toHaveLength(0);
    const inspected = await importWithMissingMetadata.inspect({ actorId, importId: paused.import.id });
    expect(inspected.outcome).toBe("paused");
  });

  it("rejects stale revisions and permits cancellation", async () => {
    const paused = await createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [{ name: "Red", yardages: Array.from({ length: 18 }, () => 400) }],
            holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })),
          },
          warnings: [],
        };
      },
    }).start({ actorId, target: { kind: "new", name: `Cancelled Course ${actorId}` }, stagedScorecardImageHandle: "cancel-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const importsWithMissingMetadata = createCourseScorecardImport({ async parseScorecardImage() { throw new Error("unused"); } });
    const conflict = await importsWithMissingMetadata.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision - 1, intent: { kind: "cancel" } });
    expect(conflict).toEqual({ outcome: "rejected", reason: "revision_conflict" });
    const cancelled = await importsWithMissingMetadata.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "cancel" } });
    expect(cancelled.outcome).toBe("cancelled");
  });

  it("persists a parser failure and publishes when parsing is retried", async () => {
    let attempts = 0;
    const retryableImports = createCourseScorecardImport({
      async parseScorecardImage() {
        attempts += 1;
        if (attempts === 1) throw new Error("temporary parser failure");
        return {
          scorecard: {
            tees: [{ name: "Black", rating: 72.1, slope: 130, yardages: Array.from({ length: 18 }, () => 400) }],
            holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })),
          },
          warnings: [],
        };
      },
    });
    const paused = await retryableImports.start({ actorId, target: { kind: "new", name: `Retry Course ${actorId}` }, stagedScorecardImageHandle: "retry-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    expect(paused.import.prompts).toContainEqual({ id: "retry:parsing", kind: "retry_parsing" });

    const published = await retryableImports.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "retry_parsing" } });
    expect(published.outcome).toBe("published");
  });
});
}
