import { describe, expect, it } from "vitest";

import { HOLE_NUMBERS } from "@/lib/rounds/completeness";
import {
  buildScoreBase,
  projectLiveRounds,
  type MatchScoreboard,
  type ScoreEntry,
} from "./live-scores";

const holes = HOLE_NUMBERS.map((hole) => ({ hole, par: 4, handicap: hole }));

function serverRound(
  id: number,
  strokesByHole: (number | null)[],
  playingHandicap: number | null = 10,
  teeYards = 400,
) {
  const scores = strokesByHole.map((strokes, i) => ({
    hole: i + 1,
    par: 4,
    strokes,
    putts: strokes == null ? null : 2,
  }));
  const recorded = scores.filter((s) => s.strokes != null);
  const totalStrokes = recorded.reduce((t, s) => t + (s.strokes ?? 0), 0);
  return {
    id,
    recordedStrokesCount: recorded.length,
    recordedPuttsCount: recorded.length,
    totalStrokes,
    totalPutts: recorded.length * 2,
    playingHandicap,
    netStrokes:
      recorded.length === 18 && playingHandicap != null
        ? totalStrokes - playingHandicap
        : null,
    scores,
    yards: HOLE_NUMBERS.map((hole) => ({ hole, yards: teeYards })),
  };
}

type Round = ReturnType<typeof serverRound>;

const empty = () => HOLE_NUMBERS.map(() => null);
const allFives = () => HOLE_NUMBERS.map(() => 5);

function edit(
  entries: ScoreEntry[],
  hole: number,
  strokes: number | null,
): ScoreEntry[] {
  return entries.map((e) =>
    e.hole === hole
      ? { ...e, strokes, putts: strokes == null ? null : 2 }
      : e,
  );
}

function matchScoreboard(rounds: Round[]): MatchScoreboard<Round> {
  return {
    format: "singles_match_play",
    rounds,
    teams: rounds.map((round) => ({
      id: round.id,
      name: `Team ${round.id}`,
      rounds: [round],
    })),
  };
}

describe("buildScoreBase", () => {
  it("gives each Round the course's pars and the yards of its own tee", () => {
    const self = serverRound(1, empty(), 10, 400);
    const mate = serverRound(2, empty(), 10, 300);

    const base = buildScoreBase([self, mate], holes);

    expect(base[1][0]).toMatchObject({ hole: 1, par: 4, yards: 400 });
    expect(base[2][0]).toMatchObject({ hole: 1, par: 4, yards: 300 });
  });
});

describe("projectLiveRounds", () => {
  it("shows a Pairing mate's unsaved edit on the Tournament leaderboard", () => {
    const self = serverRound(1, empty());
    const mate = serverRound(2, empty());
    const base = buildScoreBase([self, mate], holes);

    const live = projectLiveRounds({
      round: self,
      leaderboardRounds: [self, mate],
      matchScoreboard: null,
      scoresByRoundId: { ...base, 2: edit(base[2], 1, 3) },
    });

    const liveMate = live.leaderboardRounds?.find((r) => r.id === 2);
    expect(liveMate?.totalStrokes).toBe(3);
    expect(liveMate?.recordedStrokesCount).toBe(1);
  });

  it("shows a mate's edit in both Match Rounds and the mate's team", () => {
    const self = serverRound(1, empty());
    const mate = serverRound(2, empty());
    const base = buildScoreBase([self, mate], holes);

    const live = projectLiveRounds({
      round: self,
      leaderboardRounds: undefined,
      matchScoreboard: matchScoreboard([self, mate]),
      scoresByRoundId: { ...base, 2: edit(base[2], 1, 6) },
    });

    const liveMate = live.matchScoreboard?.rounds.find((r) => r.id === 2);
    expect(liveMate?.totalStrokes).toBe(6);
    expect(live.matchScoreboard?.teams[1].rounds[0]).toBe(liveMate);
  });

  it("lowers totals and drops net when a complete Round's hole is cleared", () => {
    const self = serverRound(1, allFives(), 10);
    const base = buildScoreBase([self], holes);

    const live = projectLiveRounds({
      round: self,
      leaderboardRounds: undefined,
      matchScoreboard: null,
      scoresByRoundId: { 1: edit(base[1], 18, null) },
    });

    expect(live.round.totalStrokes).toBe(85);
    expect(live.round.recordedStrokesCount).toBe(17);
    expect(live.round.netStrokes).toBeNull();
  });

  it("gives net only for a complete Round with a Playing Handicap", () => {
    const partial = serverRound(1, [...allFives().slice(0, 17), null], 10);
    const complete = serverRound(2, allFives(), 10);
    const noHandicap = serverRound(3, allFives(), null);
    const base = buildScoreBase([partial, complete, noHandicap], holes);

    const live = projectLiveRounds({
      round: partial,
      leaderboardRounds: [partial, complete, noHandicap],
      matchScoreboard: null,
      scoresByRoundId: base,
    });

    const byId = new Map(live.leaderboardRounds?.map((r) => [r.id, r]));
    expect(byId.get(1)?.netStrokes).toBeNull();
    expect(byId.get(2)?.netStrokes).toBe(80);
    expect(byId.get(3)?.netStrokes).toBeNull();
  });

  it("passes a Round this device cannot score through untouched", () => {
    const self = serverRound(1, empty());
    const otherPairing = serverRound(9, allFives());
    const base = buildScoreBase([self], holes);

    const live = projectLiveRounds({
      round: self,
      leaderboardRounds: [self, otherPairing],
      matchScoreboard: matchScoreboard([self, otherPairing]),
      scoresByRoundId: base,
    });

    expect(live.leaderboardRounds?.[1]).toBe(otherPairing);
    expect(live.matchScoreboard?.rounds[1]).toBe(otherPairing);
  });

  it("matches the server's totals when nothing has been edited", () => {
    const self = serverRound(1, [...allFives().slice(0, 9), ...empty().slice(9)]);
    const mate = serverRound(2, allFives(), 12);
    const base = buildScoreBase([self, mate], holes);

    const live = projectLiveRounds({
      round: self,
      leaderboardRounds: [self, mate],
      matchScoreboard: null,
      scoresByRoundId: base,
    });

    for (const [projected, server] of [
      [live.round, self],
      [live.leaderboardRounds?.[1], mate],
    ] as const) {
      expect(projected).toMatchObject({
        totalStrokes: server.totalStrokes,
        totalPutts: server.totalPutts,
        recordedStrokesCount: server.recordedStrokesCount,
        recordedPuttsCount: server.recordedPuttsCount,
        netStrokes: server.netStrokes,
      });
    }
  });
});
