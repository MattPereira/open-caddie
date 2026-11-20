import { describe, expect, it } from "vitest";

import { required } from "@/lib/required";
import * as matches from "@/modules/matches/server";
import { createFixtures } from "@/test/fixtures";

describe("Match reads", () => {
  const fixtures = createFixtures();

  type Match = Awaited<ReturnType<typeof fixtures.match>>;

  // Another Match by the same creator on the same course as `m`, with no one
  // in it.
  async function sibling(m: Match, date: string) {
    const created = await matches.createMatch(m.creator.id, {
      date,
      courseHandle: m.match.courseHandle,
      format: "singles_match_play",
      teeId: m.tee.id,
      playerIds: [],
      teamOnePlayerIds: [],
      teamTwoPlayerIds: [],
    });
    if (!created.ok) throw new Error(created.error);
    return { id: required(created.id, "match id") };
  }

  describe("by id", () => {
    it("is undefined for a missing Match", async () => {
      expect(await matches.getMatchById(2_000_000_000)).toBeUndefined();
    });

    it("carries the creator, course and Rounds", async () => {
      const m = await fixtures.match(2);
      await fixtures.match(2);

      const match = await matches.getMatchById(m.match.id);

      expect(match).toMatchObject({
        id: m.match.id,
        createdByPlayerId: m.creator.id,
        creatorLastName: m.creator.lastName,
        courseId: m.match.courseId,
      });
      expect(match?.rounds.map((round) => round.id).sort()).toEqual(
        m.players.map((p) => p.round.id).sort(),
      );
    });

    it("lists teams by sort order, each with its own Rounds", async () => {
      const m = await fixtures.match(4, {
        format: "four_ball_match_play",
        teams: [
          [0, 2],
          [1, 3],
        ],
      });
      const [a, b, c, d] = m.players.map((p) => p.round.id);

      const match = await matches.getMatchById(m.match.id);

      expect(
        match?.teams.map((t) => ({
          name: t.name,
          rounds: t.rounds.map((r) => r.id).sort(),
        })),
      ).toEqual([
        { name: "Team A", rounds: [a, c].sort() },
        { name: "Team B", rounds: [b, d].sort() },
      ]);
    });
  });

  describe("lists", () => {
    it("lists every Match newest first, latest created first on a shared date, with its player count", async () => {
      const m = await fixtures.match(3);
      const later = await sibling(m, "2026-02-01");
      const sameDay = await sibling(m, "2026-02-01");

      const all = await matches.getAllMatches();

      expect(all.map(({ id, playerCount }) => ({ id, playerCount }))).toEqual([
        { id: sameDay.id, playerCount: 0 },
        { id: later.id, playerCount: 0 },
        { id: m.match.id, playerCount: 3 },
      ]);
    });
  });
});
