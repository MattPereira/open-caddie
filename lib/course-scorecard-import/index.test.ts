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

  it("reconciles existing tees by exact name and preserves a kept Placeholder Tee", async () => {
    const [course] = await db.insert(schema.courses).values({ name: `Existing Course ${actorId}`, handle: `existing-${actorId}` }).returning({ id: schema.courses.id });
    const [blue] = await db.insert(schema.courseTees).values({ courseId: course.id, name: "Blue", rating: "69", slope: 115 }).returning({ id: schema.courseTees.id });
    const [placeholder] = await db.insert(schema.courseTees).values({ courseId: course.id, name: "Unknown", rating: "68", slope: 110 }).returning({ id: schema.courseTees.id });
    const paused = await imports.start({ actorId, target: { kind: "existing", courseId: course.id }, stagedScorecardImageHandle: "existing-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    expect(paused.import.proposedMatches).toContainEqual(expect.objectContaining({ teeId: "tee:0", kind: "exact", existingTeeIds: [blue.id] }));
    expect(paused.import.prompts).toContainEqual(expect.objectContaining({ kind: "placeholder_tee", teeId: placeholder.id }));
    const published = await imports.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "resolve", placeholderResolutions: { [String(placeholder.id)]: { kind: "keep" } } } });
    expect(published.outcome).toBe("published");
    const [updatedBlue, keptPlaceholder] = await Promise.all([
      db.select().from(schema.courseTees).where(eq(schema.courseTees.id, blue.id)),
      db.select().from(schema.courseTees).where(eq(schema.courseTees.id, placeholder.id)),
    ]);
    expect(updatedBlue[0]?.name).toBe("Blue");
    expect(keptPlaceholder[0]?.name).toBe("Unknown");
  });

  it("allows an unmatched parsed tee to be explicitly renamed onto an existing tee", async () => {
    const [course] = await db.insert(schema.courses).values({ name: `Rename Course ${actorId}`, handle: `rename-${actorId}` }).returning({ id: schema.courses.id });
    const [existing] = await db.insert(schema.courseTees).values({ courseId: course.id, name: "Championship", rating: "69", slope: 115 }).returning({ id: schema.courseTees.id });
    const renameImports = createCourseScorecardImport({ async parseScorecardImage() { return { scorecard: { tees: [{ name: "Tips", rating: 71.2, slope: 128, yardages: Array.from({ length: 18 }, () => 400) }], holes: [] }, warnings: [] }; } });
    const paused = await renameImports.start({ actorId, target: { kind: "existing", courseId: course.id }, stagedScorecardImageHandle: "rename-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    expect(paused.import.proposedMatches[0]).toMatchObject({ kind: "new" });
    const published = await renameImports.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "resolve", teeResolutions: { "tee:0": { kind: "existing", teeId: existing.id } } } });
    expect(published.outcome).toBe("published");
    const tees = await db.select().from(schema.courseTees).where(eq(schema.courseTees.id, existing.id));
    expect(tees[0]?.name).toBe("Tips");
  });

  it("uses an exact tee's saved rating and slope when parsing omits them", async () => {
    const [course] = await db.insert(schema.courses).values({ name: `Metadata Course ${actorId}`, handle: `metadata-${actorId}` }).returning({ id: schema.courses.id });
    const [blue] = await db.insert(schema.courseTees).values({ courseId: course.id, name: "Blue", rating: "69.4", slope: 117 }).returning({ id: schema.courseTees.id });
    const metadataImports = createCourseScorecardImport({ async parseScorecardImage() { return { scorecard: { tees: [{ name: "blue", yardages: Array.from({ length: 18 }, () => 400) }], holes: [] }, warnings: [] }; } });
    const published = await metadataImports.start({ actorId, target: { kind: "existing", courseId: course.id }, stagedScorecardImageHandle: "metadata-image" });
    expect(published.outcome).toBe("published");
    const tees = await db.select().from(schema.courseTees).where(eq(schema.courseTees.id, blue.id));
    expect(tees[0]).toMatchObject({ rating: "69.4", slope: 117 });
  });

  it("requires explicit resolution for ambiguous names and permits excluding a bad tee", async () => {
    const [course] = await db.insert(schema.courses).values({ name: `Ambiguous Course ${actorId}`, handle: `ambiguous-${actorId}` }).returning({ id: schema.courses.id });
    await db.insert(schema.courseTees).values([{ courseId: course.id, name: "Blue", rating: "69", slope: 115 }, { courseId: course.id, name: "blue", rating: "70", slope: 120 }]);
    const ambiguousImports = createCourseScorecardImport({ async parseScorecardImage() { return { scorecard: { tees: [{ name: "BLUE", rating: 71, slope: 125, yardages: Array.from({ length: 18 }, () => 400) }], holes: [] }, warnings: [] }; } });
    const ambiguous = await ambiguousImports.start({ actorId, target: { kind: "existing", courseId: course.id }, stagedScorecardImageHandle: "ambiguous-image" });
    expect(ambiguous.outcome).toBe("paused");
    if (ambiguous.outcome !== "paused") return;
    expect(ambiguous.import.prompts).toContainEqual(expect.objectContaining({ kind: "tee_match", teeName: "BLUE" }));
    const excluded = await ambiguousImports.continue({ actorId, importId: ambiguous.import.id, expectedRevision: ambiguous.import.revision, intent: { kind: "resolve", excludeTees: ["tee:0"] } });
    expect(excluded.outcome).toBe("published");
  });

  it("maps a parsed new tee onto the Placeholder Tee without replacing its identity", async () => {
    const [course] = await db.insert(schema.courses).values({ name: `Map Course ${actorId}`, handle: `map-${actorId}` }).returning({ id: schema.courses.id });
    const [placeholder] = await db.insert(schema.courseTees).values({ courseId: course.id, name: "Unknown", rating: "68", slope: 110 }).returning({ id: schema.courseTees.id });
    const mapImports = createCourseScorecardImport({ async parseScorecardImage() { return { scorecard: { tees: [{ name: "Gold", rating: 71, slope: 125, yardages: Array.from({ length: 18 }, () => 400) }], holes: [] }, warnings: [] }; } });
    const paused = await mapImports.start({ actorId, target: { kind: "existing", courseId: course.id }, stagedScorecardImageHandle: "map-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const published = await mapImports.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "resolve", placeholderResolutions: { [String(placeholder.id)]: { kind: "map", teeId: "tee:0" } } } });
    expect(published.outcome).toBe("published");
    const tees = await db.select().from(schema.courseTees).where(eq(schema.courseTees.id, placeholder.id));
    expect(tees[0]).toMatchObject({ id: placeholder.id, name: "Gold" });
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
    expect(conflict).toMatchObject({ outcome: "rejected", reason: "revision_conflict", import: { id: paused.import.id } });
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
    expect(paused.import.allowedIntents).toEqual(["cancel", "retry_parsing", "replace_scorecard_image"]);
    expect(paused.import.prompts).toContainEqual({ id: "retry:parsing", kind: "retry_parsing" });

    const published = await retryableImports.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "retry_parsing" } });
    expect(published.outcome).toBe("published");
  });

  it("replaces a failed scorecard image while retaining the import target", async () => {
    const replacementImport = createCourseScorecardImport({
      async parseScorecardImage(handle) {
        if (handle === "bad-image") throw new Error("unreadable image");
        return {
          scorecard: {
            tees: [{ name: "Blue", rating: 71, slope: 125, yardages: Array.from({ length: 18 }, () => 400) }],
            holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })),
          },
          warnings: [],
        };
      },
    });
    const paused = await replacementImport.start({ actorId, target: { kind: "new", name: `Replacement Course ${actorId}` }, stagedScorecardImageHandle: "bad-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const replaced = await replacementImport.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: { kind: "replace_scorecard_image", stagedScorecardImageHandle: "good-image" },
    });
    expect(replaced.outcome).toBe("published");
    if (replaced.outcome !== "published") return;
    expect(replaced.handle).toBe(paused.import.target.handle);
  });

  it("keeps a failed replacement as the retryable image and retains the previous image for cleanup", async () => {
    const replacementImport = createCourseScorecardImport({
      async parseScorecardImage() { throw new Error("unreadable image"); },
    });
    const paused = await replacementImport.start({ actorId, target: { kind: "new", name: `Failed Replacement ${actorId}` }, stagedScorecardImageHandle: "first-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const replaced = await replacementImport.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "replace_scorecard_image", stagedScorecardImageHandle: "replacement-image" } });
    expect(replaced.outcome).toBe("paused");
    if (replaced.outcome !== "paused") return;
    expect(replaced.import.allowedIntents).toEqual(["cancel", "retry_parsing", "replace_scorecard_image"]);
    const [row] = await db.select().from(schema.courseScorecardImports).where(eq(schema.courseScorecardImports.id, paused.import.id));
    expect(row.stagedScorecardImageHandle).toBe("replacement-image");
    expect(row.stagedImageDeletionHandles).toEqual(["first-image"]);
  });

  it("cancels immediately, clears draft data, and retries failed staged-image deletion", async () => {
    const deleted: string[] = [];
    let failDeletion = true;
    const cancellable = createCourseScorecardImport({
      async parseScorecardImage() { throw new Error("unreadable image"); },
      async deleteStagedImage(handle) {
        deleted.push(handle);
        return !failDeletion;
      },
    });
    const paused = await cancellable.start({ actorId, target: { kind: "new", name: `Cancel Cleanup ${actorId}` }, stagedScorecardImageHandle: "staged-scorecard", stagedCourseImageHandle: "staged-course" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    await db.update(schema.courseScorecardImports).set({ stagedImageDeletionHandles: ["older-staged-image"] }).where(eq(schema.courseScorecardImports.id, paused.import.id));

    const cancelled = await cancellable.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "cancel" } });
    expect(cancelled.outcome).toBe("cancelled");
    expect(deleted).toEqual(["older-staged-image", "older-staged-image", "staged-scorecard", "staged-course"]);
    const [tombstone] = await db.select().from(schema.courseScorecardImports).where(eq(schema.courseScorecardImports.id, paused.import.id));
    expect(tombstone.stagedScorecardImageHandle).toBe("");
    expect(tombstone.stagedImageDeletionHandles).toEqual(["older-staged-image", "staged-scorecard", "staged-course"]);
    expect(tombstone.document).toMatchObject({ tees: [], holes: [], warnings: [] });

    failDeletion = false;
    await cancellable.cleanup({ actorId });
    const [cleaned] = await db.select().from(schema.courseScorecardImports).where(eq(schema.courseScorecardImports.id, paused.import.id));
    expect(cleaned.stagedImageDeletionHandles).toEqual([]);
  });

  it("extends expiry when inspected and expires inactive imports during authenticated cleanup", async () => {
    let clock = new Date("2026-01-01T00:00:00.000Z");
    const expiring = createCourseScorecardImport({
      now: () => clock,
      async parseScorecardImage() { throw new Error("unreadable image"); },
    });
    const paused = await expiring.start({ actorId, target: { kind: "new", name: `Expiry ${actorId}` }, stagedScorecardImageHandle: "expiry-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const originalExpiry = paused.import.expiresAt!;

    clock = new Date(clock.getTime() + 24 * 60 * 60 * 1000);
    const inspected = await expiring.inspect({ actorId, importId: paused.import.id });
    expect(inspected.outcome).toBe("paused");
    if (inspected.outcome !== "paused") return;
    expect(inspected.import.expiresAt!.getTime()).toBeGreaterThan(originalExpiry.getTime());

    clock = new Date(inspected.import.expiresAt!.getTime() + 1);
    await expiring.cleanup({ actorId });
    const [expired] = await db.select().from(schema.courseScorecardImports).where(eq(schema.courseScorecardImports.id, paused.import.id));
    expect(expired.status).toBe("cancelled");
    expect(expired.stagedImageDeletionHandles).toEqual([]);
  });

  it("never queues published course images for import cleanup", async () => {
    const deleted: string[] = [];
    const publishable = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: { tees: [{ name: "Blue", rating: 71, slope: 125, yardages: Array.from({ length: 18 }, () => 400) }], holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })) },
          warnings: [],
        };
      },
      async deleteStagedImage(handle) { deleted.push(handle); return true; },
    });
    const published = await publishable.start({ actorId, target: { kind: "new", name: `Published Images ${actorId}` }, stagedScorecardImageHandle: "course-owned-scorecard", stagedCourseImageHandle: "course-owned-image" });
    expect(published.outcome).toBe("published");
    await publishable.cleanup({ actorId });
    expect(deleted).toEqual([]);
  });

  it("reserves active targets, rejects live handle conflicts, and makes an identical start idempotent", async () => {
    const pausedImports = createCourseScorecardImport({
      async parseScorecardImage() {
        return { scorecard: { tees: [{ name: "Blue", yardages: Array.from({ length: 18 }, () => 400) }], holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })) }, warnings: [] };
      },
    });
    const name = `Reserved Course ${actorId}`;
    const first = await pausedImports.start({ actorId, target: { kind: "new", name }, stagedScorecardImageHandle: "reserved-image" });
    expect(first.outcome).toBe("paused");
    const repeated = await pausedImports.start({ actorId: secondActorId, target: { kind: "new", name }, stagedScorecardImageHandle: "reserved-image" });
    expect(repeated).toMatchObject({ outcome: "paused", import: { id: first.outcome === "paused" ? first.import.id : "" } });
    const conflicting = await pausedImports.start({ actorId: secondActorId, target: { kind: "new", name }, stagedScorecardImageHandle: "other-image" });
    expect(conflicting).toEqual({ outcome: "rejected", reason: "active_import_conflict" });

    await db.insert(schema.courses).values({ name: `Live Handle ${actorId}`, handle: `live-handle-${actorId}` });
    const liveConflict = await pausedImports.start({ actorId, target: { kind: "new", name: `Live Handle ${actorId}` }, stagedScorecardImageHandle: "live-image" });
    expect(liveConflict).toEqual({ outcome: "rejected", reason: "target_exists" });
  });

  it("serializes concurrent starts and rejects non-administrators through the module interface", async () => {
    const outsiderId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: outsiderId, isAdmin: false });
    const guarded = createCourseScorecardImport({ async parseScorecardImage() { return { scorecard: { tees: [{ name: "Blue", yardages: Array.from({ length: 18 }, () => 400) }], holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })) }, warnings: [] }; } });
    const target = { kind: "new" as const, name: `Concurrent ${actorId}` };
    const [first, second] = await Promise.all([
      guarded.start({ actorId, target, stagedScorecardImageHandle: "concurrent-one" }),
      guarded.start({ actorId: secondActorId, target, stagedScorecardImageHandle: "concurrent-two" }),
    ]);
    expect([first.outcome, second.outcome].sort()).toEqual(["paused", "rejected"]);
    expect(await guarded.start({ actorId: outsiderId, target: { kind: "new", name: `Forbidden ${actorId}` }, stagedScorecardImageHandle: "forbidden" })).toEqual({ outcome: "rejected", reason: "forbidden" });
    await db.delete(schema.users).where(eq(schema.users.id, outsiderId));
  });

  it("returns the current view on a revision conflict without merging the intent", async () => {
    const paused = await createCourseScorecardImport({ async parseScorecardImage() { return { scorecard: { tees: [{ name: "Blue", yardages: Array.from({ length: 18 }, () => 400) }], holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })) }, warnings: [] }; } }).start({ actorId, target: { kind: "new", name: `Revision ${actorId}` }, stagedScorecardImageHandle: "revision-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const advanced = await imports.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "resolve", teeMetadata: { "tee:0:metadata": { rating: 70, slope: 120 } } } });
    expect(advanced.outcome).toBe("published");
    const conflict = await imports.continue({ actorId: secondActorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "cancel" } });
    expect(conflict).toMatchObject({ outcome: "rejected", reason: "revision_conflict", import: { id: paused.import.id, status: "published" } });
  });

  it("marks an existing-course import stale when its starting fingerprint changes", async () => {
    const [course] = await db.insert(schema.courses).values({ name: `Stale ${actorId}`, handle: `stale-${actorId}` }).returning({ id: schema.courses.id });
    const staleImports = createCourseScorecardImport({ async parseScorecardImage() { return { scorecard: { tees: [{ name: "Blue", rating: 71, slope: 125, yardages: Array.from({ length: 18 }, () => 400) }], holes: [] }, warnings: [] }; } });
    const paused = await staleImports.start({ actorId, target: { kind: "existing", courseId: course.id }, stagedScorecardImageHandle: "stale-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    await db.update(schema.courses).set({ scorecardImgUrl: "changed-by-another-admin" }).where(eq(schema.courses.id, course.id));
    const continued = await staleImports.continue({ actorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "resolve", teeResolutions: { "tee:0": { kind: "new" } } } });
    expect(continued).toMatchObject({ outcome: "stale", import: { id: paused.import.id, status: "stale" } });
    const inspected = await staleImports.inspect({ actorId: secondActorId, importId: paused.import.id });
    expect(inspected).toMatchObject({ outcome: "stale", import: { id: paused.import.id, status: "stale" } });
  });

  it("keeps a published import's parser, decisions, warnings, actors, and timestamps inspectable", async () => {
    const audited = createCourseScorecardImport({
      async parseScorecardImage() {
        return { scorecard: { tees: [{ name: "Blue", rating: 71, slope: 125, yardages: Array.from({ length: 18 }, () => 400) }], holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1 })) }, warnings: ["parser warning"], parserModel: "test-model" };
      },
    });
    const paused = await audited.start({ actorId, target: { kind: "new", name: `Audit ${actorId}` }, stagedScorecardImageHandle: "audit-image" });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const published = await audited.continue({ actorId: secondActorId, importId: paused.import.id, expectedRevision: paused.import.revision, intent: { kind: "resolve", acknowledgeWarnings: ["warning:0"] } });
    expect(published.outcome).toBe("published");
    const inspected = await audited.inspect({ actorId, importId: paused.import.id });
    expect(inspected).toMatchObject({ outcome: "published", import: { audit: { creatorId: actorId, lastEditorId: secondActorId, parserModel: "test-model", warnings: ["parser warning"], decisions: [expect.objectContaining({ actorId: secondActorId, decision: { kind: "resolve", acknowledgeWarnings: ["warning:0"] } })], events: expect.arrayContaining([expect.objectContaining({ event: "started", actorId, at: expect.any(String) }), expect.objectContaining({ event: "published", at: expect.any(String) })]) } } });
  });
});
}
