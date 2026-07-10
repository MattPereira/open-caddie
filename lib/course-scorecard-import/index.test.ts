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
  const { eq } = await import("drizzle-orm");
  const actorId = crypto.randomUUID();
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
  });

  afterEach(async () => {
    await db.delete(schema.courseScorecardImports).where(eq(schema.courseScorecardImports.createdByUserId, actorId));
    await db.delete(schema.users).where(eq(schema.users.id, actorId));
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
});
}
