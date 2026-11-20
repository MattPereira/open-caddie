import { describe, expect, it } from "vitest";

import { createFixtures } from "@/test/fixtures";
import {
  imports,
  importsParsing,
  parsedTee,
  importActors,
} from "./scorecard-import-fixtures";

describe("Course Scorecard Import concurrency and audit", () => {
  const fixtures = createFixtures();
  const run = importActors(fixtures);

  it("reserves active targets, rejects live handle conflicts, and makes an identical start idempotent", async () => {
    const pausedImports = importsParsing({ tees: [parsedTee("Blue")] });
    const name = `Reserved Course ${run.tag}`;
    const first = await pausedImports.start({
      actorId: run.actorId,
      target: { kind: "new", name },
      stagedScorecardImageHandle: "reserved-image",
    });
    expect(first.outcome).toBe("paused");
    const repeated = await pausedImports.start({
      actorId: run.secondActorId,
      target: { kind: "new", name },
      stagedScorecardImageHandle: "reserved-image",
    });
    expect(repeated).toMatchObject({
      outcome: "paused",
      import: { id: first.outcome === "paused" ? first.import.id : "" },
    });
    const conflicting = await pausedImports.start({
      actorId: run.secondActorId,
      target: { kind: "new", name },
      stagedScorecardImageHandle: "other-image",
    });
    expect(conflicting).toEqual({
      outcome: "rejected",
      reason: "active_import_conflict",
    });

    await fixtures.course({
      name: `Live Handle ${run.tag}`,
      handle: `live-handle-${run.tag}`,
    });
    const liveConflict = await pausedImports.start({
      actorId: run.actorId,
      target: { kind: "new", name: `Live Handle ${run.tag}` },
      stagedScorecardImageHandle: "live-image",
    });
    expect(liveConflict).toEqual({
      outcome: "rejected",
      reason: "target_exists",
    });
  });

  it("serializes concurrent starts and rejects non-administrators through the module interface", async () => {
    const outsiderId = (await fixtures.player()).id;
    const guarded = importsParsing({ tees: [parsedTee("Blue")] });
    const target = { kind: "new" as const, name: `Concurrent ${run.tag}` };
    const [first, second] = await Promise.all([
      guarded.start({
        actorId: run.actorId,
        target,
        stagedScorecardImageHandle: "concurrent-one",
      }),
      guarded.start({
        actorId: run.secondActorId,
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
        target: { kind: "new", name: `Forbidden ${run.tag}` },
        stagedScorecardImageHandle: "forbidden",
      }),
    ).toEqual({ outcome: "rejected", reason: "forbidden" });
  });

  it("returns the current view on a revision conflict without merging the intent", async () => {
    const paused = await importsParsing({ tees: [parsedTee("Blue")] }).start({
      actorId: run.actorId,
      target: { kind: "new", name: `Revision ${run.tag}` },
      stagedScorecardImageHandle: "revision-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const advanced = await imports.continue({
      actorId: run.actorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: {
        kind: "resolve",
        teeMetadata: { "tee:0:metadata": { rating: 70, slope: 120 } },
      },
    });
    expect(advanced.outcome).toBe("published");
    const conflict = await imports.continue({
      actorId: run.secondActorId,
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
    const audited = importsParsing({
      tees: [parsedTee("Blue", { rating: 71, slope: 125 })],
      warnings: [{ scope: "tee" as const, message: "parser warning" }],
      parserModel: "test-model",
    });
    const paused = await audited.start({
      actorId: run.actorId,
      target: { kind: "new", name: `Audit ${run.tag}` },
      stagedScorecardImageHandle: "audit-image",
    });
    expect(paused.outcome).toBe("paused");
    if (paused.outcome !== "paused") return;
    const published = await audited.continue({
      actorId: run.secondActorId,
      importId: paused.import.id,
      expectedRevision: paused.import.revision,
      intent: { kind: "resolve", acknowledgeWarnings: ["warning:0"] },
    });
    expect(published.outcome).toBe("published");
    const inspected = await audited.inspect({
      actorId: run.actorId,
      importId: paused.import.id,
    });
    expect(inspected).toMatchObject({
      outcome: "published",
      import: {
        audit: {
          creatorId: run.actorId,
          lastEditorId: run.secondActorId,
          parserModel: "test-model",
          warnings: ["parser warning"],
          decisions: [
            expect.objectContaining({
              actorId: run.secondActorId,
              decision: { kind: "resolve", acknowledgeWarnings: ["warning:0"] },
            }),
          ],
          events: expect.arrayContaining([
            expect.objectContaining({
              event: "started",
              actorId: run.actorId,
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
