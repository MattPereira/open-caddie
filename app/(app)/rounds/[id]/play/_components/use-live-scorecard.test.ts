import { describe, expect, it } from "vitest";

import type { ScoreEntry } from "./round-score-state";
import {
  createLiveScorecardState,
  readLiveScorecard,
  reduceLiveScorecard,
} from "./use-live-scorecard";

const score = (strokes: number | null): ScoreEntry => ({
  hole: 1,
  par: 4,
  yards: 400,
  strokes,
  putts: strokes == null ? null : 2,
});

const patch = (strokes: number) => ({ strokes, putts: 2 });

describe("live scorecard reconciliation", () => {
  it("lets the wake snapshot replace an accepted local score", () => {
    let state = createLiveScorecardState({ 1: [score(null)] }, { 1: [] });
    state = reduceLiveScorecard(state, {
      type: "edit-applied",
      roundId: 1,
      hole: 1,
      edit: {
        kind: "score",
        version: 1,
        value: patch(5),
        status: "pending",
        retireOnSnapshot: false,
      },
    });
    state = reduceLiveScorecard(state, {
      type: "edit-accepted",
      kind: "score",
      roundId: 1,
      hole: 1,
      version: 1,
    });
    state = reduceLiveScorecard(state, { type: "refresh-started" });
    state = reduceLiveScorecard(state, {
      type: "snapshot",
      scoreBase: { 1: [score(6)] },
      greenieBase: { 1: [] },
    });

    expect(readLiveScorecard(state).scoresByRoundId[1][0].strokes).toBe(6);
  });

  it("keeps a pending score over a wake snapshot", () => {
    let state = createLiveScorecardState({ 1: [score(null)] }, { 1: [] });
    state = reduceLiveScorecard(state, {
      type: "edit-applied",
      roundId: 1,
      hole: 1,
      edit: {
        kind: "score",
        version: 1,
        value: patch(5),
        status: "pending",
        retireOnSnapshot: false,
      },
    });
    state = reduceLiveScorecard(state, { type: "refresh-started" });
    state = reduceLiveScorecard(state, {
      type: "snapshot",
      scoreBase: { 1: [score(null)] },
      greenieBase: { 1: [] },
    });

    expect(readLiveScorecard(state).scoresByRoundId[1][0].strokes).toBe(5);
  });

  it("does not retire a save accepted after the refresh started", () => {
    let state = createLiveScorecardState({ 1: [score(null)] }, { 1: [] });
    state = reduceLiveScorecard(state, {
      type: "edit-applied",
      roundId: 1,
      hole: 1,
      edit: {
        kind: "score",
        version: 1,
        value: patch(5),
        status: "pending",
        retireOnSnapshot: false,
      },
    });
    state = reduceLiveScorecard(state, { type: "refresh-started" });
    state = reduceLiveScorecard(state, {
      type: "edit-accepted",
      kind: "score",
      roundId: 1,
      hole: 1,
      version: 1,
    });
    state = reduceLiveScorecard(state, {
      type: "snapshot",
      scoreBase: { 1: [score(null)] },
      greenieBase: { 1: [] },
    });

    expect(readLiveScorecard(state).scoresByRoundId[1][0].strokes).toBe(5);

    state = reduceLiveScorecard(state, { type: "refresh-started" });
    state = reduceLiveScorecard(state, {
      type: "snapshot",
      scoreBase: { 1: [score(6)] },
      greenieBase: { 1: [] },
    });
    expect(readLiveScorecard(state).scoresByRoundId[1][0].strokes).toBe(6);
  });

  it("reveals the refreshed server score when a newer save fails", () => {
    let state = createLiveScorecardState({ 1: [score(null)] }, { 1: [] });
    state = reduceLiveScorecard(state, {
      type: "edit-applied",
      roundId: 1,
      hole: 1,
      edit: {
        kind: "score",
        version: 1,
        value: patch(5),
        status: "pending",
        retireOnSnapshot: false,
      },
    });
    state = reduceLiveScorecard(state, {
      type: "edit-accepted",
      kind: "score",
      roundId: 1,
      hole: 1,
      version: 1,
    });
    state = reduceLiveScorecard(state, {
      type: "edit-applied",
      roundId: 1,
      hole: 1,
      edit: {
        kind: "score",
        version: 2,
        value: patch(7),
        status: "pending",
        retireOnSnapshot: false,
      },
    });
    state = reduceLiveScorecard(state, { type: "refresh-started" });
    state = reduceLiveScorecard(state, {
      type: "snapshot",
      scoreBase: { 1: [score(6)] },
      greenieBase: { 1: [] },
    });
    state = reduceLiveScorecard(state, {
      type: "edit-rejected",
      kind: "score",
      roundId: 1,
      hole: 1,
      version: 2,
    });

    expect(readLiveScorecard(state).scoresByRoundId[1][0].strokes).toBe(6);
  });

  it("uses the same lifecycle for a Greenie deletion", () => {
    let state = createLiveScorecardState(
      { 1: [score(4)] },
      { 1: [{ hole: 1, feet: 4, inches: 0 }] },
    );
    state = reduceLiveScorecard(state, {
      type: "edit-applied",
      roundId: 1,
      hole: 1,
      edit: {
        kind: "greenie",
        version: 1,
        value: null,
        status: "pending",
        retireOnSnapshot: false,
      },
    });
    state = reduceLiveScorecard(state, {
      type: "edit-accepted",
      kind: "greenie",
      roundId: 1,
      hole: 1,
      version: 1,
    });
    state = reduceLiveScorecard(state, { type: "refresh-started" });
    state = reduceLiveScorecard(state, {
      type: "snapshot",
      scoreBase: { 1: [score(4)] },
      greenieBase: { 1: [{ hole: 1, feet: 8, inches: 6 }] },
    });

    expect(readLiveScorecard(state).greeniesByRoundId[1]).toEqual([
      { hole: 1, feet: 8, inches: 6 },
    ]);
  });
});
