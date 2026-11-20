import { beforeEach, describe, expect, it } from "vitest";

import { required } from "@/lib/required";
import { createFixtures } from "@/test/fixtures";
import { createCourseScorecardImport } from "../server";

describe("Course Scorecard Import lifecycle", () => {
  const fixtures = createFixtures();
  let actorId: string;
  let tag: string;
  // Unique per test. Import cleanup scans every import in the database, so
  // tests tell their own staged images apart by it.
  beforeEach(async () => {
    tag = crypto.randomUUID();
    actorId = await fixtures.admin();
  });

  it("rejects stale revisions and permits cancellation", async () => {
    const paused = await createCourseScorecardImport({
      async parseScorecardImage() {
        return {
          scorecard: {
            tees: [
              { name: "Red", yardages: Array.from({ length: 18 }, () => 400) },
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
    }).start({
      actorId,
      target: { kind: "new", name: `Cancelled Course ${tag}` },
      stagedScorecardImageHandle: "cancel-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const importsWithMissingMetadata = createCourseScorecardImport({
      async parseScorecardImage() {
        throw new Error("unused");
      },
    });
    const conflict = await importsWithMissingMetadata.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision - 1,
      intent: { kind: "cancel" },
    });
    expect(conflict).toMatchObject({
      outcome: "rejected",
      reason: "revision_conflict",
      import: { id: paused.import.id },
    });
    const cancelled = await importsWithMissingMetadata.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: { kind: "cancel" },
    });
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
            tees: [
              {
                name: "Black",
                rating: 72.1,
                slope: 130,
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
    const paused = await retryableImports.start({
      actorId,
      target: { kind: "new", name: `Retry Course ${tag}` },
      stagedScorecardImageHandle: "retry-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    expect(paused.import.allowedIntents).toEqual([
      "cancel",
      "retry_parsing",
      "replace_scorecard_image",
    ]);
    expect(paused.import.prompts).toContainEqual({
      id: "retry:parsing",
      kind: "retry_parsing",
    });

    const published = await retryableImports.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: { kind: "retry_parsing" },
    });
    expect(published.outcome).toBe("published");
  });

  it("replaces a failed scorecard image while retaining the import target", async () => {
    const replacementImport = createCourseScorecardImport({
      async parseScorecardImage(handle) {
        if (handle === "bad-image") throw new Error("unreadable image");
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
          warnings: [],
        };
      },
    });
    const paused = await replacementImport.start({
      actorId,
      target: { kind: "new", name: `Replacement Course ${tag}` },
      stagedScorecardImageHandle: "bad-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const replaced = await replacementImport.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: {
        kind: "replace_scorecard_image",
        stagedScorecardImageHandle: "good-image",
      },
    });
    expect(replaced.outcome).toBe("published");
    if (replaced.outcome !== "published") return;
    expect(replaced.handle).toBe(paused.import.target.handle);
  });

  it("keeps a failed replacement as the retryable image and retains the previous image for cleanup", async () => {
    const parsed: string[] = [];
    const deleted: string[] = [];
    const replacementImport = createCourseScorecardImport({
      async parseScorecardImage(handle) {
        parsed.push(handle);
        throw new Error("unreadable image");
      },
      async deleteStagedImage(handle) {
        deleted.push(handle);
        return true;
      },
    });
    const paused = await replacementImport.start({
      actorId,
      target: { kind: "new", name: `Failed Replacement ${tag}` },
      stagedScorecardImageHandle: `${tag}-first-image`,
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const replaced = await replacementImport.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: {
        kind: "replace_scorecard_image",
        stagedScorecardImageHandle: `${tag}-replacement-image`,
      },
    });
    expect(replaced.outcome).toBe("paused");
    if (replaced.outcome !== "paused") return;
    expect(replaced.import.allowedIntents).toEqual([
      "cancel",
      "retry_parsing",
      "replace_scorecard_image",
    ]);

    await replacementImport.continue({
      actorId,
      importId: replaced.import.id,
      expectedRevision: replaced.import.revision,
      intent: { kind: "retry_parsing" },
    });
    expect(parsed.at(-1)).toBe(`${tag}-replacement-image`);
    expect(deleted.filter((handle) => handle.startsWith(tag))).toEqual([
      `${tag}-first-image`,
    ]);
  });

  it("cancels immediately, clears draft data, and retries failed staged-image deletion", async () => {
    const deleted: string[] = [];
    let failDeletion = true;
    const cancellable = createCourseScorecardImport({
      async parseScorecardImage() {
        throw new Error("unreadable image");
      },
      async deleteStagedImage(handle) {
        deleted.push(handle);
        return !failDeletion;
      },
    });
    const older = `${tag}-older-staged-image`;
    const scorecard = `${tag}-staged-scorecard`;
    const courseImage = `${tag}-staged-course`;
    const ours = () => deleted.filter((handle) => handle.startsWith(tag));
    const first = await cancellable.start({
      actorId,
      target: { kind: "new", name: `Cancel Cleanup ${tag}` },
      stagedScorecardImageHandle: older,
      stagedCourseImageHandle: courseImage,
    });
    expect(first.outcome).toBe("paused");
    if (first.outcome !== "paused") return;
    const paused = await cancellable.continue({
      actorId,
      importId: first.import.id,
      expectedRevision: first.import.revision,
      intent: {
        kind: "replace_scorecard_image",
        stagedScorecardImageHandle: scorecard,
      },
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const cancelled = await cancellable.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: { kind: "cancel" },
    });
    expect(cancelled.outcome).toBe("cancelled");
    if (cancelled.outcome !== "cancelled") return;
    expect(ours()).toEqual([older, older, scorecard, courseImage]);
    expect(cancelled.import.parsed).toEqual({ tees: [], holes: [] });

    failDeletion = false;
    deleted.length = 0;
    expect(await cancellable.cleanup({ actorId })).toEqual({
      outcome: "cleaned",
    });
    expect(ours()).toEqual([older, scorecard, courseImage]);

    deleted.length = 0;
    await cancellable.cleanup({ actorId });
    expect(ours()).toEqual([]);
  });

  it("extends expiry when inspected and expires inactive imports during authenticated cleanup", async () => {
    let clock = new Date("2026-01-01T00:00:00.000Z");
    const deleted: string[] = [];
    const expiring = createCourseScorecardImport({
      now: () => clock,
      async parseScorecardImage() {
        throw new Error("unreadable image");
      },
      async deleteStagedImage(handle) {
        deleted.push(handle);
        return true;
      },
    });
    const paused = await expiring.start({
      actorId,
      target: { kind: "new", name: `Expiry ${tag}` },
      stagedScorecardImageHandle: `${tag}-expiry-image`,
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const originalExpiry = required(paused.import.expiresAt, "expiry");

    clock = new Date(clock.getTime() + 24 * 60 * 60 * 1000);
    const inspected = await expiring.inspect({
      actorId,
      importId: paused.import.id,
    });
    expect(inspected.outcome).toBe("paused");
    if (inspected.outcome !== "paused") return;
    const extendedExpiry = required(inspected.import.expiresAt, "expiry");
    expect(extendedExpiry.getTime()).toBeGreaterThan(originalExpiry.getTime());

    clock = new Date(extendedExpiry.getTime() + 1);
    expect(deleted).not.toContain(`${tag}-expiry-image`);
    await expiring.cleanup({ actorId });
    expect(deleted).toContain(`${tag}-expiry-image`);
    expect(
      await expiring.inspect({ actorId, importId: paused.import.id }),
    ).toMatchObject({ outcome: "cancelled", import: { status: "cancelled" } });
  });

  it("never queues published course images for import cleanup", async () => {
    const deleted: string[] = [];
    const publishable = createCourseScorecardImport({
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
          warnings: [],
        };
      },
      async deleteStagedImage(handle) {
        deleted.push(handle);
        return true;
      },
    });
    const published = await publishable.start({
      actorId,
      target: { kind: "new", name: `Published Images ${tag}` },
      stagedScorecardImageHandle: "course-owned-scorecard",
      stagedCourseImageHandle: "course-owned-image",
    });
    expect(published.outcome).toBe("published");
    await publishable.cleanup({ actorId });
    expect(deleted).toEqual([]);
  });
});
