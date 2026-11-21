import { describe, expect, it } from "vitest";
import { findPlayerRound } from "../index";

const rounds = [
  { id: 1, playerId: "ann" },
  { id: 2, playerId: "bob" },
  { id: 3, playerId: "cal" },
];

describe("findPlayerRound", () => {
  it("finds the Round the Player played", () => {
    expect(findPlayerRound(rounds, "bob")).toEqual({ id: 2, playerId: "bob" });
  });

  it("is null when the Player didn't play", () => {
    expect(findPlayerRound(rounds, "dee")).toBeNull();
  });

  it("is null for a visitor who isn't a Player", () => {
    expect(findPlayerRound(rounds, null)).toBeNull();
    expect(findPlayerRound(rounds, undefined)).toBeNull();
    expect(findPlayerRound([{ id: 4, playerId: "" }], "")).toBeNull();
  });

  it("is null when there are no Rounds", () => {
    expect(findPlayerRound([], "ann")).toBeNull();
  });
});
