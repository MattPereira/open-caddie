import { beforeEach, describe, expect, it } from "vitest";

import { createFixtures } from "@/test/fixtures";
import { createCourseScorecardImport } from "../server";
import { imports } from "./scorecard-import-fixtures";

describe("Course Scorecard Import concurrency and audit", () => {
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

  it("reserves active targets, rejects live handle conflicts, and makes an identical start idempotent", async () => {
    const pausedImports = createCourseScorecardImport({
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
    const name = `Reserved Course ${tag}`;
    const first = await pausedImports.start({
      actorId,
      target: { kind: "new", name },
      stagedScorecardImageHandle: "reserved-image",
    });
    expect(first.outcome).toBe("paused");
    const repeated = await pausedImports.start({
      actorId: secondActorId,
      target: { kind: "new", name },
      stagedScorecardImageHandle: "reserved-image",
    });
    expect(repeated).toMatchObject({
      outcome: "paused",
      import: { id: first.outcome === "paused" ? first.import.id : "" },
    });
    const conflicting = await pausedImports.start({
      actorId: secondActorId,
      target: { kind: "new", name },
      stagedScorecardImageHandle: "other-image",
    });
    expect(conflicting).toEqual({
      outcome: "rejected",
      reason: "active_import_conflict",
    });

    await fixtures.course({
      name: `Live Handle ${tag}`,
      handle: `live-handle-${tag}`,
    });
    const liveConflict = await pausedImports.start({
      actorId,
      target: { kind: "new", name: `Live Handle ${tag}` },
      stagedScorecardImageHandle: "live-image",
    });
    expect(liveConflict).toEqual({
      outcome: "rejected",
      reason: "target_exists",
    });
  });

  it("serializes concurrent starts and rejects non-administrators through the module interface", async () => {
    const outsiderId = (await fixtures.player()).id;
    const guarded = createCourseScorecardImport({
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
    const target = { kind: "new" as const, name: `Concurrent ${tag}` };
    const [first, second] = await Promise.all([
      guarded.start({
        actorId,
        target,
        stagedScorecardImageHandle: "concurrent-one",
      }),
      guarded.start({
        actorId: secondActorId,
        target,
        stagedScorecardImageHandle: "concurrent-two",
      }),
    ]);
    expect([first.outcome, second.outcome].sort()).toEqual([
      "paused",
      "rejected",
    ]);
    expect(
      await guarded.start({
        actorId: outsiderId,
        target: { kind: "new", name: `Forbidden ${tag}` },
        stagedScorecardImageHandle: "forbidden",
      }),
    ).toEqual({ outcome: "rejected", reason: "forbidden" });
  });

  it("returns the current view on a revision conflict without merging the intent", async () => {
    const paused = await createCourseScorecardImport({
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
    }).start({
      actorId,
      target: { kind: "new", name: `Revision ${tag}` },
      stagedScorecardImageHandle: "revision-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const advanced = await imports.continue({
      actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: {
        kind: "resolve",
        teeMetadata: { "tee:0:metadata": { rating: 70, slope: 120 } },
      },
    });
    expect(advanced.outcome).toBe("published");
    const conflict = await imports.continue({
      actorId: secondActorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: { kind: "cancel" },
    });
    expect(conflict).toMatchObject({
      outcome: "rejected",
      reason: "revision_conflict",
      import: { id: paused.import.id, status: "published" },
    });
  });

  it("keeps a published import's parser, decisions, warnings, actors, and timestamps inspectable", async () => {
    const audited = createCourseScorecardImport({
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
          warnings: [{ scope: "tee" as const, message: "parser warning" }],
          parserModel: "test-model",
        };
      },
    });
    const paused = await audited.start({
      actorId,
      target: { kind: "new", name: `Audit ${tag}` },
      stagedScorecardImageHandle: "audit-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const published = await audited.continue({
      actorId: secondActorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: { kind: "resolve", acknowledgeWarnings: ["warning:0"] },
    });
    expect(published.outcome).toBe("published");
    const inspected = await audited.inspect({
      actorId,
      importId: paused.import.id,
    });
    expect(inspected).toMatchObject({
      outcome: "published",
      import: {
        audit: {
          creatorId: actorId,
          lastEditorId: secondActorId,
          parserModel: "test-model",
          warnings: ["parser warning"],
          decisions: [
            expect.objectContaining({
              actorId: secondActorId,
              decision: { kind: "resolve", acknowledgeWarnings: ["warning:0"] },
            }),
          ],
          events: expect.arrayContaining([
            expect.objectContaining({
              event: "started",
              actorId,
              at: expect.any(String),
            }),
            expect.objectContaining({
              event: "published",
              at: expect.any(String),
            }),
          ]),
        },
      },
    });
  });
});
