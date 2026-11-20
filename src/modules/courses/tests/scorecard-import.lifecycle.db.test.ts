import { describe, expect, it } from "vitest";

import { required } from "@/lib/required";
import { createFixtures } from "@/test/fixtures";
import { createCourseScorecardImport } from "../server";
import {
  importsParsing,
  parsedTee,
  parsedScorecard,
  importActors,
} from "./scorecard-import-fixtures";

describe("Course Scorecard Import lifecycle", () => {
  const fixtures = createFixtures();
  const run = importActors(fixtures);

  it("rejects stale revisions and permits cancellation", async () => {
    const paused = await importsParsing({ tees: [parsedTee("Red")] }).start({
      actorId: run.actorId,
      target: { kind: "new", name: `Cancelled Course ${run.tag}` },
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
      actorId: run.actorId,
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
      actorId: run.actorId,
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
        return parsedScorecard({
          tees: [parsedTee("Black", { rating: 72.1, slope: 130 })],
        });
      },
    });
    const paused = await retryableImports.start({
      actorId: run.actorId,
      target: { kind: "new", name: `Retry Course ${run.tag}` },
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
      actorId: run.actorId,
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
        return parsedScorecard({
          tees: [parsedTee("Blue", { rating: 71, slope: 125 })],
        });
      },
    });
    const paused = await replacementImport.start({
      actorId: run.actorId,
      target: { kind: "new", name: `Replacement Course ${run.tag}` },
      stagedScorecardImageHandle: "bad-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const replaced = await replacementImport.continue({
      actorId: run.actorId,
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
      actorId: run.actorId,
      target: { kind: "new", name: `Failed Replacement ${run.tag}` },
      stagedScorecardImageHandle: `${run.tag}-first-image`,
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;

    const replaced = await replacementImport.continue({
      actorId: run.actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: {
        kind: "replace_scorecard_image",
        stagedScorecardImageHandle: `${run.tag}-replacement-image`,
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
      actorId: run.actorId,
      importId: replaced.import.id,
      expectedRevision: replaced.import.revision,
      intent: { kind: "retry_parsing" },
    });
    expect(parsed.at(-1)).toBe(`${run.tag}-replacement-image`);
    expect(deleted.filter((handle) => handle.startsWith(run.tag))).toEqual([
      `${run.tag}-first-image`,
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
    const older = `${run.tag}-older-staged-image`;
    const scorecard = `${run.tag}-staged-scorecard`;
    const courseImage = `${run.tag}-staged-course`;
    const ours = () => deleted.filter((handle) => handle.startsWith(run.tag));
    const first = await cancellable.start({
      actorId: run.actorId,
      target: { kind: "new", name: `Cancel Cleanup ${run.tag}` },
      stagedScorecardImageHandle: older,
      stagedCourseImageHandle: courseImage,
    });
    expect(first.outcome).toBe("paused");
    if (first.outcome !== "paused") return;
    const paused = await cancellable.continue({
      actorId: run.actorId,
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
      actorId: run.actorId,
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
    expect(await cancellable.cleanup({ actorId: run.actorId })).toEqual({
      outcome: "cleaned",
    });
    expect(ours()).toEqual([older, scorecard, courseImage]);

    deleted.length = 0;
    await cancellable.cleanup({ actorId: run.actorId });
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
      actorId: run.actorId,
      target: { kind: "new", name: `Expiry ${run.tag}` },
      stagedScorecardImageHandle: `${run.tag}-expiry-image`,
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const originalExpiry = required(paused.import.expiresAt, "expiry");

    clock = new Date(clock.getTime() + 24 * 60 * 60 * 1000);
    const inspected = await expiring.inspect({
      actorId: run.actorId,
      importId: paused.import.id,
    });
    expect(inspected.outcome).toBe("paused");
    if (inspected.outcome !== "paused") return;
    const extendedExpiry = required(inspected.import.expiresAt, "expiry");
    expect(extendedExpiry.getTime()).toBeGreaterThan(originalExpiry.getTime());

    clock = new Date(extendedExpiry.getTime() + 1);
    expect(deleted).not.toContain(`${run.tag}-expiry-image`);
    await expiring.cleanup({ actorId: run.actorId });
    expect(deleted).toContain(`${run.tag}-expiry-image`);
    expect(
      await expiring.inspect({
        actorId: run.actorId,
        importId: paused.import.id,
      }),
    ).toMatchObject({ outcome: "cancelled", import: { status: "cancelled" } });
  });

  it("never queues published course images for import cleanup", async () => {
    const deleted: string[] = [];
    const publishable = createCourseScorecardImport({
      async parseScorecardImage() {
        return parsedScorecard({
          tees: [parsedTee("Blue", { rating: 71, slope: 125 })],
        });
      },
      async deleteStagedImage(handle) {
        deleted.push(handle);
        return true;
      },
    });
    const published = await publishable.start({
      actorId: run.actorId,
      target: { kind: "new", name: `Published Images ${run.tag}` },
      stagedScorecardImageHandle: "course-owned-scorecard",
      stagedCourseImageHandle: "course-owned-image",
    });
    expect(published.outcome).toBe("published");
    await publishable.cleanup({ actorId: run.actorId });
    expect(deleted).toEqual([]);
  });
});
