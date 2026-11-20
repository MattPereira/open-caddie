import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFixtures } from "@/test/fixtures";
import { failCourseHoleInserts } from "@/test/db/faults";
import { createCourseScorecardImport, getCourseForEdit } from "../server";
import { imports } from "./scorecard-import-fixtures";

describe("Course Scorecard Import", () => {
  const fixtures = createFixtures();
  let actorId: string;
  let secondActorId: string;
  let tag: string;
  // Unique per test. Import cleanup scans every import in the database, so
  // tests tell their own staged images apart by it.
  beforeEach(async () => {
    tag = crypto.randomUUID();
    actorId = await fixtures.admin();
    secondActorId = (await fixtures.player({ isAdmin: true })).id;
  });
  let removeFault: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await removeFault?.();
    removeFault = undefined;
  });

  it("publishes a clean new course", async () => {
    const outcome = await imports.start({
      actorId,
      target: { kind: "new", name: `Test Course ${tag}` },
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
            tees: [
              { name: "Gold", yardages: Array.from({ length: 18 }, () => 400) },
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
    const paused = await missingMetadataImport.start({
      actorId,
      target: { kind: "new", name: `Paused Course ${tag}` },
      stagedScorecardImageHandle: "missing-meta-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const published = await missingMetadataImport.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: {
        kind: "resolve",
        teeMetadata: { "tee:0:metadata": { rating: 69.4, slope: 117 } },
      },
    });
    expect(published.outcome).toBe("published");
  });

  it("allows another administrator to inspect and resolve a paused import", async () => {
    const importsWithMissingMetadata = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              {
                name: "White",
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
    const paused = await importsWithMissingMetadata.start({
      actorId,
      target: { kind: "new", name: `Shared Course ${tag}` },
      stagedScorecardImageHandle: "shared-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const inspected = await importsWithMissingMetadata.inspect({
      actorId: secondActorId,
      importId: paused.import.id,
    });
    expect(inspected.outcome).toBe("paused");
    if (inspected.outcome !== "paused") return;

    const published = await importsWithMissingMetadata.continue({
      actorId: secondActorId,
      importId: inspected.import.id,
      expectedRevision: inspected.import.revision,
      intent: {
        kind: "resolve",
        teeMetadata: { "tee:0:metadata": { rating: 68.8, slope: 114 } },
      },
    });
    expect(published.outcome).toBe("published");
  });

  it("persists partial answers and recomputes only the remaining prompts", async () => {
    const twoMissingTees = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: ["Blue", "White"].map((name) => ({
              name,
              yardages: Array.from({ length: 18 }, () => 400),
            })),
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
    const paused = await twoMissingTees.start({
      actorId,
      target: { kind: "new", name: `Partial Course ${tag}` },
      stagedScorecardImageHandle: "partial-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const partial = await twoMissingTees.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: {
        kind: "resolve",
        teeMetadata: { "tee:0:metadata": { rating: 70, slope: 120 } },
      },
    });
    expect(partial.outcome).toBe("paused");
    if (partial.outcome !== "paused") return;
    expect(partial.import.revision).toBeGreaterThan(paused.import.revision);
    expect(partial.import.prompts).toContainEqual({
      id: "tee:1:metadata",
      kind: "tee_metadata",
      teeIndex: 1,
      teeName: "White",
    });

    const published = await twoMissingTees.continue({
      actorId,
      importId: partial.import.id,
      expectedRevision: partial.import.revision,
      intent: {
        kind: "resolve",
        teeMetadata: { "tee:1:metadata": { rating: 69, slope: 116 } },
      },
    });
    expect(published.outcome).toBe("published");
  });

  it("invalidates warning acknowledgement after a correction", async () => {
    const warningImport = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              {
                name: "Blue",
                rating: 71,
                slope: 125,
                yardages: Array.from({ length: 18 }, () => 400),
              },
            ],
            holes: Array.from({ length: 18 }, (_, index) => ({
              hole: index + 1,
              par: 4,
              handicap: index + 1,
            })),
          },
          warnings: [
            {
              scope: "tee" as const,
              message: "Blue total does not match the card",
            },
          ],
        };
      },
    });
    const paused = await warningImport.start({
      actorId,
      target: { kind: "new", name: `Warning Course ${tag}` },
      stagedScorecardImageHandle: "warning-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const corrected = await warningImport.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: {
        kind: "resolve",
        acknowledgeWarnings: ["warning:0"],
        corrections: { tees: { "tee:0": { name: "Blue Championship" } } },
      },
    });
    expect(corrected.outcome).toBe("paused");
    if (corrected.outcome !== "paused") return;
    expect(corrected.import.prompts).toContainEqual({
      id: "warning:0",
      kind: "warning_acknowledgement",
      warning: "Blue total does not match the card",
    });

    const published = await warningImport.continue({
      actorId,
      importId: corrected.import.id,
      expectedRevision: corrected.import.revision,
      intent: { kind: "resolve", acknowledgeWarnings: ["warning:0"] },
    });
    expect(published.outcome).toBe("published");
  });

  it("allows an administrator to exclude an erroneous parsed tee", async () => {
    const importWithBadTee = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              {
                name: "Blue",
                rating: 71,
                slope: 125,
                yardages: Array.from({ length: 18 }, () => 400),
              },
              {
                name: "Parser Error",
                rating: 71,
                slope: 125,
                yardages: Array.from({ length: 18 }, () => 0),
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
    const paused = await importWithBadTee.start({
      actorId,
      target: { kind: "new", name: `Excluded Course ${tag}` },
      stagedScorecardImageHandle: "excluded-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    expect(paused.import.parsed.tees[1]).toMatchObject({
      id: "tee:1",
      excluded: false,
    });

    const published = await importWithBadTee.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: { kind: "resolve", excludeTees: ["tee:1"] },
    });
    expect(published.outcome).toBe("published");
  });

  it("rolls back every live-course write when publication fails", async () => {
    const importWithMissingMetadata = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              { name: "Blue", yardages: Array.from({ length: 18 }, () => 400) },
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
    const name = `Rollback Course ${tag}`;
    const paused = await importWithMissingMetadata.start({
      actorId,
      target: { kind: "new", name },
      stagedScorecardImageHandle: "rollback-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    removeFault = await failCourseHoleInserts(name);
    await expect(
      importWithMissingMetadata.continue({
        actorId,
        importId: paused.import.id,
        expectedRevision: paused.import.revision,
        intent: {
          kind: "resolve",
          teeMetadata: { "tee:0:metadata": { rating: 71, slope: 125 } },
        },
      }),
    ).rejects.toThrow();

    expect(await getCourseForEdit(paused.import.target.handle)).toBeUndefined();
    const inspected = await importWithMissingMetadata.inspect({
      actorId,
      importId: paused.import.id,
    });
    expect(inspected.outcome).toBe("paused");
  });
});
