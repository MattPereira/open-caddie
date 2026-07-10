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
  const { eq, like } = await import("drizzle-orm");
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
