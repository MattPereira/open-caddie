import { describe, expect, it } from "vitest";
import { findPlayerRound } from "../index";

const rounds = [
  { id: 1, playerId: "tiger" },
  { id: 2, playerId: "rory" },
  { id: 3, playerId: "phil" },
];

describe("A Player's Round in an event", () => {
  it("is the Round that Player played", () => {
    expect(findPlayerRound(rounds, "rory")).toEqual({
      id: 2,
      playerId: "rory",
    });
  });

  it("is missing for a Player who didn't play", () => {
    expect(findPlayerRound(rounds, "annika")).toBeNull();
  });

  it("is missing for a visitor who isn't a Player", () => {
    expect(findPlayerRound(rounds, null)).toBeNull();
    expect(findPlayerRound(rounds, undefined)).toBeNull();
    expect(findPlayerRound(rounds, "")).toBeNull();
  });

  it("is missing when the event has no Rounds", () => {
    expect(findPlayerRound([], "tiger")).toBeNull();
  });
});
