import { describe, expect, it } from "vitest";

import {
  comparePlayers,
  fieldSkins,
  greenieWinners,
  rankPutts,
  rankStrokes,
} from "./results";

type Player = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
};

function player(userId: string, lastName: string | null = userId): Player {
  return { userId, firstName: null, lastName, username: null };
}

function round(
  userId: string,
  overrides: Partial<{
    lastName: string | null;
    isComplete: boolean;
    netStrokes: number | null;
    totalStrokes: number;
    totalPutts: number;
    recordedPuttsCount: number;
  }> = {},
) {
  return {
    ...player(userId, overrides.lastName ?? userId),
    isComplete: true,
    netStrokes: 72,
    totalStrokes: 80,
    totalPutts: 32,
    recordedPuttsCount: 18,
    ...overrides,
  };
}

const ids = (rounds: { userId: string }[]) => rounds.map((r) => r.userId);

describe("comparePlayers", () => {
  it("orders by last name, first name, username, then user id", () => {
    const players = [
      { userId: "4", lastName: "B", firstName: "A", username: "a" },
      { userId: "3", lastName: "A", firstName: "B", username: "a" },
      { userId: "2", lastName: "A", firstName: "A", username: "b" },
      { userId: "1", lastName: "A", firstName: "A", username: "b" },
      { userId: "0", lastName: "A", firstName: "A", username: "a" },
    ];

    expect(ids([...players].sort(comparePlayers))).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
    ]);
  });
});

describe("rankStrokes", () => {
  it("ranks complete Rounds by net, then gross, then player", () => {
    const ranked = rankStrokes([
      round("d", { netStrokes: 70 }),
      round("c", { netStrokes: 68, totalStrokes: 82 }),
      round("b", { netStrokes: 68, totalStrokes: 80 }),
      round("a", { netStrokes: 70 }),
    ]);

    expect(ids(ranked)).toEqual(["b", "c", "a", "d"]);
  });

  it("excludes incomplete Rounds and Rounds without a net score", () => {
    const ranked = rankStrokes([
      round("a", { isComplete: false, netStrokes: 60 }),
      round("b", { netStrokes: null }),
      round("c"),
    ]);

    expect(ids(ranked)).toEqual(["c"]);
  });
});

describe("rankPutts", () => {
  it("ranks by putts, then net, then gross, then player", () => {
    const ranked = rankPutts([
      round("e", { totalPutts: 30, netStrokes: 70, totalStrokes: 80 }),
      round("d", { totalPutts: 30, netStrokes: 70, totalStrokes: 80 }),
      round("c", { totalPutts: 30, netStrokes: 70, totalStrokes: 78 }),
      round("b", { totalPutts: 30, netStrokes: 69, totalStrokes: 90 }),
      round("a", { totalPutts: 31, netStrokes: 60 }),
    ]);

    expect(ids(ranked)).toEqual(["b", "c", "d", "e", "a"]);
  });

  it("ranks a Round without a net score after one with a net score", () => {
    const ranked = rankPutts([
      round("a", { totalPutts: 30, netStrokes: null }),
      round("b", { totalPutts: 30, netStrokes: 80 }),
    ]);

    expect(ids(ranked)).toEqual(["b", "a"]);
  });

  it("requires a complete Round with putts on all 18 holes", () => {
    const ranked = rankPutts([
      round("a", { recordedPuttsCount: 17, totalPutts: 20 }),
      round("b", { isComplete: false, totalPutts: 20 }),
      round("c"),
    ]);

    expect(ids(ranked)).toEqual(["c"]);
  });
});

describe("greenieWinners", () => {
  it("picks the closest Greenie on each hole, ordered by hole", () => {
    const winners = greenieWinners([
      { ...player("a"), hole: 7, feet: 3, inches: 0 },
      { ...player("b"), hole: 3, feet: 10, inches: 2 },
      { ...player("c"), hole: 3, feet: 10, inches: 1 },
      { ...player("d"), hole: 7, feet: 2, inches: 11 },
    ]);

    expect(winners.map((g) => [g.hole, g.userId])).toEqual([
      [3, "c"],
      [7, "d"],
    ]);
  });

  it("breaks equal distances with the player tiebreak", () => {
    const winners = greenieWinners([
      { ...player("z", "Same"), hole: 3, feet: 5, inches: 0 },
      { ...player("y", "Same"), hole: 3, feet: 5, inches: 0 },
    ]);

    expect(winners.map((g) => g.userId)).toEqual(["y"]);
  });
});

describe("fieldSkins", () => {
  function skinsRound(
    userId: string,
    playingHandicap: number,
    strokesByHole: Partial<Record<number, number | null>>,
    isComplete = true,
  ) {
    return {
      ...player(userId),
      isComplete,
      playingHandicap,
      scores: Array.from({ length: 18 }, (_, index) => ({
        hole: index + 1,
        handicap: index + 1,
        strokes: index + 1 in strokesByHole ? strokesByHole[index + 1]! : 4,
      })),
    };
  }

  it("awards a hole to a unique low net score", () => {
    const skins = fieldSkins([
      skinsRound("a", 0, { 18: 3 }),
      skinsRound("b", 0, {}),
    ]);

    expect(skins).toEqual([
      expect.objectContaining({ hole: 18, strokes: 3, netStrokes: 3 }),
    ]);
    expect(skins[0].round.userId).toBe("a");
  });

  it("does not carry tied holes forward", () => {
    const skins = fieldSkins([
      skinsRound("a", 0, { 1: 3, 2: 3 }),
      skinsRound("b", 0, { 1: 3 }),
    ]);

    expect(skins.map((skin) => [skin.hole, skin.round.userId])).toEqual([
      [2, "a"],
    ]);
  });

  it("voids a hole when any complete Round has no score on it", () => {
    const skins = fieldSkins([
      skinsRound("a", 0, { 1: 2 }),
      skinsRound("b", 0, { 1: null }),
    ]);

    expect(skins).toEqual([]);
  });

  it("ignores incomplete Rounds", () => {
    const skins = fieldSkins([
      skinsRound("a", 0, { 1: 3 }),
      skinsRound("b", 0, {}),
      skinsRound("c", 0, { 1: 2, 2: null }, false),
    ]);

    expect(skins.map((skin) => [skin.hole, skin.round.userId])).toEqual([
      [1, "a"],
    ]);
  });

  it("gives one stroke on holes up to half the Playing Handicap, rounded down", () => {
    const skins = fieldSkins([
      skinsRound("a", 5, { 2: 4, 3: 4 }),
      skinsRound("b", 0, { 2: 5, 3: 3 }),
    ]);

    // PH 5 → strokes on hole handicaps 1–2, so a's 4 on hole 2 nets 3.
    expect(
      skins.map((skin) => [skin.hole, skin.round.userId, skin.netStrokes]),
    ).toEqual([
      [1, "a", 3],
      [2, "a", 3],
      [3, "b", 3],
    ]);
  });

  it("caps strokes at one per hole", () => {
    const skins = fieldSkins([
      skinsRound("a", 54, {}),
      skinsRound("b", 0, { 18: 2 }),
    ]);

    expect(skins).toHaveLength(18);
    expect(skins.at(-1)).toEqual(
      expect.objectContaining({ hole: 18, netStrokes: 2 }),
    );
  });
});
