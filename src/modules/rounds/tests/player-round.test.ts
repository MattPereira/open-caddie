import { describe, expect, it } from "vitest";
import { findPlayerRound } from "../index";

const rounds = [
  { id: 1, playerId: "rory" },
  { id: 2, playerId: "tiger" },
  { id: 3, playerId: "phil" },
];

describe("A Player's Round in an Event", () => {
  it("is the Round that Player played", () => {
    expect(findPlayerRound(rounds, "tiger")).toEqual({
      id: 2,
      playerId: "tiger",
    });
  });

  it("is missing when the Player did not play", () => {
    expect(findPlayerRound(rounds, "annika")).toBeNull();
  });

  it("is missing when the viewer is not a Player", () => {
    expect(findPlayerRound(rounds, null)).toBeNull();
    expect(findPlayerRound(rounds, undefined)).toBeNull();
  });

  it("is missing when the Event has no Rounds", () => {
    expect(findPlayerRound([], "tiger")).toBeNull();
  });
});
