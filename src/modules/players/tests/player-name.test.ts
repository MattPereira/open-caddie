import { describe, expect, it } from "vitest";

import {
  comparePlayers,
  displayName,
  getInitials,
  type NamedPlayer,
  type SortablePlayer,
} from "../player-name";

function named(overrides: Partial<NamedPlayer> = {}): NamedPlayer {
  return { email: null, firstName: null, lastName: null, username: null, ...overrides };
}

function sortable(overrides: Partial<SortablePlayer> = {}): SortablePlayer {
  return { playerId: "p", firstName: null, lastName: null, username: null, ...overrides };
}

describe("displayName", () => {
  it("falls back from full name to username, then email, then a placeholder", () => {
    const all = { firstName: "Ann", lastName: "Lee", username: "ann", email: "a@example.com" };
    expect(displayName(named(all))).toBe("Ann Lee");
    expect(displayName(named({ ...all, lastName: null }))).toBe("Ann");
    expect(displayName(named({ ...all, firstName: null, lastName: null }))).toBe("ann");
    expect(displayName(named({ email: "a@example.com" }))).toBe("a@example.com");
    expect(displayName(named())).toBe("Unnamed player");
  });
});

describe("getInitials", () => {
  it("uses first and last initials", () => {
    expect(getInitials(named({ firstName: "ann", lastName: "lee" }))).toBe("AL");
    expect(getInitials(named({ firstName: "Ann" }))).toBe("A");
  });

  it("falls back to two characters of the username or email, then ?", () => {
    expect(getInitials(named({ username: "zed", email: "a@example.com" }))).toBe("ZE");
    expect(getInitials(named({ email: "bo@example.com" }))).toBe("BO");
    expect(getInitials(named())).toBe("?");
  });
});

describe("comparePlayers", () => {
  it("orders by last name, first name, username, then Player id", () => {
    const players = [
      sortable({ playerId: "6", lastName: "B", firstName: "A", username: "a" }),
      sortable({ playerId: "5", lastName: "A", firstName: "B", username: "a" }),
      sortable({ playerId: "4", lastName: "A", firstName: "A", username: "b" }),
      sortable({ playerId: "3", lastName: "A", firstName: "A", username: "a" }),
      sortable({ playerId: "2", lastName: "A", firstName: "A", username: "a" }),
    ];
    expect(players.sort(comparePlayers).map((p) => p.playerId)).toEqual([
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
  });
});
