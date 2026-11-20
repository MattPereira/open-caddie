import { beforeEach, describe, expect, it } from "vitest";

import { createFixtures } from "@/test/fixtures";
import { required } from "@/lib/required";
import {
  createCourseScorecardImport,
  getCourseForEdit,
  updateCourse,
} from "../server";
import { imports } from "./scorecard-import-fixtures";

describe("Course Scorecard Import into an existing course", () => {
  const fixtures = createFixtures();
  let actorId: string;
  let secondActorId: string;
  beforeEach(async () => {
    actorId = await fixtures.admin();
    secondActorId = (await fixtures.player({ isAdmin: true })).id;
  });

  async function storedTees(handle: string) {
    return required(await getCourseForEdit(handle), "course").tees;
  }

  async function existingCourse(
    name: string,
    tees: { name: string; rating: string; slope: number }[],
  ) {
    const { course } = await fixtures.course({
      name: `${name} ${crypto.randomUUID()}`,
      tees: tees.map((tee, sortOrder) => ({
        ...tee,
        color: "",
        yardages: Array.from({ length: 18 }, () => "" as const),
        sortOrder,
      })),
    });
    return { course, tees: await storedTees(course.handle) };
  }

  function teeNamed(tees: { id: number; name: string }[], name: string) {
    return required(
      tees.find((tee) => tee.name === name),
      `tee ${name}`,
    );
  }

  it("matches existing tees by exact name and preserves a kept Placeholder Tee", async () => {
    const { course, tees } = await existingCourse("Existing Course", [
      { name: "Blue", rating: "69", slope: 115 },
      { name: "Unknown", rating: "68", slope: 110 },
    ]);
    const blue = teeNamed(tees, "Blue");
    const placeholder = teeNamed(tees, "Unknown");
    const paused = await imports.start({
      actorId,
      target: { kind: "existing", courseId: course.id },
      stagedScorecardImageHandle: "existing-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    expect(paused.import.proposedMatches).toContainEqual(
      expect.objectContaining({
        teeId: "tee:0",
        kind: "exact",
        existingTeeIds: [blue.id],
      }),
    );
    expect(paused.import.prompts).toContainEqual(
      expect.objectContaining({
        kind: "placeholder_tee",
        teeId: placeholder.id,
      }),
    );
    const published = await imports.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: {
        kind: "resolve",
        placeholderResolutions: { [String(placeholder.id)]: { kind: "keep" } },
      },
    });
    expect(published.outcome).toBe("published");
    const after = await storedTees(course.handle);
    expect(after.find((tee) => tee.id === blue.id)?.name).toBe("Blue");
    expect(after.find((tee) => tee.id === placeholder.id)?.name).toBe(
      "Unknown",
    );
  });

  it("ignores hole warnings but still requires acknowledging tee warnings for an existing course", async () => {
    const { course } = await existingCourse("Existing Warnings", [
      { name: "Blue", rating: "69", slope: 115 },
    ]);
    const existingWarningImports = createCourseScorecardImport({
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
            holes: [],
          },
          warnings: [
            {
              scope: "hole" as const,
              message: "par OUT: summed 34 vs printed 35",
            },
            {
              scope: "tee" as const,
              message: "Blue OUT yards: summed 3600 vs printed 3601",
            },
          ],
        };
      },
    });
    const paused = await existingWarningImports.start({
      actorId,
      target: { kind: "existing", courseId: course.id },
      stagedScorecardImageHandle: "existing-warnings-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    expect(paused.import.prompts).toEqual([
      expect.objectContaining({
        kind: "warning_acknowledgement",
        warning: "Blue OUT yards: summed 3600 vs printed 3601",
      }),
    ]);
    const published = await existingWarningImports.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: { kind: "resolve", acknowledgeWarnings: ["warning:1"] },
    });
    expect(published.outcome).toBe("published");
  });

  it("defaults an unmatched parsed tee to new and publishes without pausing", async () => {
    const { course } = await existingCourse("Auto New Course", [
      { name: "Championship", rating: "69", slope: 115 },
    ]);
    const autoNewImports = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              {
                name: "Tips",
                rating: 71.2,
                slope: 128,
                yardages: Array.from({ length: 18 }, () => 400),
              },
            ],
            holes: [],
          },
          warnings: [],
        };
      },
    });
    const published = await autoNewImports.start({
      actorId,
      target: { kind: "existing", courseId: course.id },
      stagedScorecardImageHandle: "auto-new-image",
    });
    expect(published.outcome).toBe("published");
    const tees = await storedTees(course.handle);
    expect(tees.map((tee) => tee.name).sort()).toEqual([
      "Championship",
      "Tips",
    ]);
  });

  it("allows an unmatched parsed tee to be explicitly renamed onto an existing tee", async () => {
    const { course, tees: before } = await existingCourse("Rename Course", [
      { name: "Championship", rating: "69", slope: 115 },
      { name: "Unknown", rating: "68", slope: 110 },
    ]);
    const existing = teeNamed(before, "Championship");
    const placeholder = teeNamed(before, "Unknown");
    const renameImports = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              {
                name: "Tips",
                rating: 71.2,
                slope: 128,
                yardages: Array.from({ length: 18 }, () => 400),
              },
            ],
            holes: [],
          },
          warnings: [],
        };
      },
    });
    const paused = await renameImports.start({
      actorId,
      target: { kind: "existing", courseId: course.id },
      stagedScorecardImageHandle: "rename-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    expect(paused.import.proposedMatches[0]).toMatchObject({ kind: "new" });
    expect(paused.import.prompts).toContainEqual(
      expect.objectContaining({
        kind: "placeholder_tee",
        teeId: placeholder.id,
      }),
    );
    const published = await renameImports.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: {
        kind: "resolve",
        placeholderResolutions: { [String(placeholder.id)]: { kind: "keep" } },
        teeResolutions: { "tee:0": { kind: "existing", teeId: existing.id } },
      },
    });
    expect(published.outcome).toBe("published");
    const tees = await storedTees(course.handle);
    expect(tees.find((tee) => tee.id === existing.id)?.name).toBe("Tips");
  });

  it("uses an exact tee's saved rating and slope when parsing omits them", async () => {
    const { course, tees: before } = await existingCourse("Metadata Course", [
      { name: "Blue", rating: "69.4", slope: 117 },
    ]);
    const blue = teeNamed(before, "Blue");
    const metadataImports = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              { name: "blue", yardages: Array.from({ length: 18 }, () => 400) },
            ],
            holes: [],
          },
          warnings: [],
        };
      },
    });
    const published = await metadataImports.start({
      actorId,
      target: { kind: "existing", courseId: course.id },
      stagedScorecardImageHandle: "metadata-image",
    });
    expect(published.outcome).toBe("published");
    const tees = await storedTees(course.handle);
    expect(tees.find((tee) => tee.id === blue.id)).toMatchObject({
      rating: "69.4",
      slope: 117,
    });
  });

  it("requires explicit resolution for ambiguous names and permits excluding a bad tee", async () => {
    const { course } = await existingCourse("Ambiguous Course", [
      { name: "Blue", rating: "69", slope: 115 },
      { name: "blue", rating: "70", slope: 120 },
    ]);
    const ambiguousImports = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              {
                name: "BLUE",
                rating: 71,
                slope: 125,
                yardages: Array.from({ length: 18 }, () => 400),
              },
            ],
            holes: [],
          },
          warnings: [],
        };
      },
    });
    const ambiguous = await ambiguousImports.start({
      actorId,
      target: { kind: "existing", courseId: course.id },
      stagedScorecardImageHandle: "ambiguous-image",
    });
    expect(ambiguous.outcome).toBe("paused");
    if (ambiguous.outcome !== "paused") return;
    expect(ambiguous.import.prompts).toContainEqual(
      expect.objectContaining({ kind: "tee_match", teeName: "BLUE" }),
    );
    const excluded = await ambiguousImports.continue({
      actorId,
      importId: ambiguous.import.id,
      expectedRevision: ambiguous.import.revision,
      intent: { kind: "resolve", excludeTees: ["tee:0"] },
    });
    expect(excluded.outcome).toBe("published");
  });

  it("maps a parsed new tee onto the Placeholder Tee without replacing its identity", async () => {
    const { course, tees: before } = await existingCourse("Map Course", [
      { name: "Unknown", rating: "68", slope: 110 },
    ]);
    const placeholder = teeNamed(before, "Unknown");
    const mapImports = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              {
                name: "Gold",
                rating: 71,
                slope: 125,
                yardages: Array.from({ length: 18 }, () => 400),
              },
            ],
            holes: [],
          },
          warnings: [],
        };
      },
    });
    const paused = await mapImports.start({
      actorId,
      target: { kind: "existing", courseId: course.id },
      stagedScorecardImageHandle: "map-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const published = await mapImports.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: {
        kind: "resolve",
        placeholderResolutions: {
          [String(placeholder.id)]: { kind: "map", teeId: "tee:0" },
        },
      },
    });
    expect(published.outcome).toBe("published");
    const tees = await storedTees(course.handle);
    expect(tees).toContainEqual(
      expect.objectContaining({ id: placeholder.id, name: "Gold" }),
    );
  });

  it("fully tombstones a cancelled existing-course import", async () => {
    const { course } = await existingCourse("Existing Cancel", [
      { name: "Unknown", rating: "69", slope: 115 },
    ]);
    const existingCancelImports = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              { name: "Gold", yardages: Array.from({ length: 18 }, () => 400) },
            ],
            holes: [],
          },
          warnings: [],
        };
      },
    });
    const paused = await existingCancelImports.start({
      actorId,
      target: { kind: "existing", courseId: course.id },
      stagedScorecardImageHandle: "existing-cancel-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const cancelled = await existingCancelImports.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: { kind: "cancel" },
    });
    expect(cancelled.outcome).toBe("cancelled");
    // The Placeholder Tee prompt comes from the stored snapshot of the
    // course's tees, so its absence shows the snapshot was dropped too.
    expect(paused.import.prompts).toContainEqual(
      expect.objectContaining({ kind: "placeholder_tee" }),
    );
    const tombstone = await existingCancelImports.inspect({
      actorId,
      importId: paused.import.id,
    });
    expect(tombstone).toMatchObject({
      outcome: "cancelled",
      import: {
        parsed: { tees: [], holes: [] },
        proposedMatches: [],
        prompts: [],
        audit: { warnings: [] },
      },
    });
  });

  it("marks an existing-course import stale when its starting fingerprint changes", async () => {
    const { course } = await existingCourse("Stale", [
      { name: "Red", rating: "69", slope: 115 },
    ]);
    const staleImports = createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              { name: "Blue", yardages: Array.from({ length: 18 }, () => 400) },
            ],
            holes: [],
          },
          warnings: [],
        };
      },
    });
    const paused = await staleImports.start({
      actorId,
      target: { kind: "existing", courseId: course.id },
      stagedScorecardImageHandle: "stale-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const current = required(await getCourseForEdit(course.handle), "course");
    const edited = await updateCourse(secondActorId, {
      id: current.id,
      handle: current.handle,
      name: `${current.name} (renamed by another admin)`,
      imgUrl: current.imgUrl ?? "",
      tees: current.tees.map((tee) => ({
        id: tee.id,
        name: tee.name,
        color: tee.color ?? "",
        rating: tee.rating,
        slope: tee.slope,
        yardages: tee.yardages.map((yards) => yards ?? ("" as const)),
        sortOrder: tee.sortOrder,
      })),
      holes: current.holes,
    });
    expect(edited.ok).toBe(true);
    const continued = await staleImports.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: {
        kind: "resolve",
        teeMetadata: { "tee:0:metadata": { rating: 71, slope: 125 } },
      },
    });
    expect(continued).toMatchObject({
      outcome: "stale",
      import: { id: paused.import.id, status: "stale" },
    });
    const inspected = await staleImports.inspect({
      actorId: secondActorId,
      importId: paused.import.id,
    });
    expect(inspected).toMatchObject({
      outcome: "stale",
      import: { id: paused.import.id, status: "stale" },
    });
  });
});
