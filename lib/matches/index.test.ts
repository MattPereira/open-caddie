import { describe, expect, it } from "vitest";

import { evaluateMatchPlay, type MatchPlayPlayer } from "./index";

const scores = (
  strokesByHole: Partial<Record<number, number | null>>,
): MatchPlayPlayer["scores"] =>
  Array.from({ length: 18 }, (_, index) => ({
    hole: index + 1,
    handicap: index + 1,
    strokes: strokesByHole[index + 1] ?? null,
  }));

describe("evaluateMatchPlay", () => {
  it("scores Singles from each player's gross, net, and received strokes", () => {
    const result = evaluateMatchPlay([
      {
        id: "low",
        players: [
          { id: 1, playingHandicap: 4, scores: scores({ 1: 4 }) },
        ],
      },
      {
        id: "high",
        players: [
          { id: 2, playingHandicap: 5, scores: scores({ 1: 4 }) },
        ],
      },
    ]);

    expect(result.holes[0]).toMatchObject({
      winningTeamId: "high",
      teams: [
        {
          teamId: "low",
          players: [
            { playerId: 1, grossScore: 4, receivedStrokes: 0, netScore: 4 },
          ],
        },
        {
          teamId: "high",
          players: [
            { playerId: 2, grossScore: 4, receivedStrokes: 1, netScore: 3 },
          ],
        },
      ],
    });
  });

  it("scores Three-Ball at 100% relative Playing Handicaps", () => {
    const result = evaluateMatchPlay([
      {
        id: "four",
        players: [
          { id: 1, playingHandicap: 4, scores: scores({ 2: 4 }) },
        ],
      },
      {
        id: "five",
        players: [
          { id: 2, playingHandicap: 5, scores: scores({ 2: 4 }) },
        ],
      },
      {
        id: "six",
        players: [
          { id: 3, playingHandicap: 6, scores: scores({ 2: 4 }) },
        ],
      },
    ]);

    expect(result.holes[1]).toMatchObject({
      winningTeamId: "six",
      teams: [
        { players: [{ receivedStrokes: 0, netScore: 4 }] },
        { players: [{ receivedStrokes: 0, netScore: 4 }] },
        { players: [{ receivedStrokes: 1, netScore: 3 }] },
      ],
    });
  });

  it("scores Four-Ball at 90% and selects each team's low net player", () => {
    const result = evaluateMatchPlay(
      [
        {
          id: "a",
          players: [
            { id: 1, playingHandicap: 0, scores: scores({ 5: 4 }) },
            { id: 2, playingHandicap: 10, scores: scores({ 5: 5 }) },
          ],
        },
        {
          id: "b",
          players: [
            { id: 3, playingHandicap: 11, scores: scores({ 5: 4 }) },
            { id: 4, playingHandicap: 20, scores: scores({ 5: 6 }) },
          ],
        },
      ],
      { allowance: 0.9 },
    );

    expect(result.holes[4]).toMatchObject({
      winningTeamId: "b",
      teams: [
        {
          netScore: 4,
          players: [
            { playerId: 1, receivedStrokes: 0, netScore: 4 },
            { playerId: 2, receivedStrokes: 1, netScore: 4 },
          ],
        },
        {
          netScore: 3,
          players: [
            { playerId: 3, receivedStrokes: 1, netScore: 3 },
            { playerId: 4, receivedStrokes: 1, netScore: 5 },
          ],
        },
      ],
    });
  });
});
