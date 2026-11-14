import { describe, expect, it } from "vitest";

import { db } from "@/db";
import * as schema from "@/db/schema";
import * as matches from "@/modules/matches";
import { createRoundFixtures } from "@/test/fixtures/rounds";

describe("Match reads", () => {
  const fixtures = createRoundFixtures(db, schema);

  type Match = Awaited<ReturnType<typeof fixtures.match>>;

  async function team(m: Match, name: string, sortOrder: number, roundIds: number[]) {
    const [created] = await db
      .insert(schema.matchTeams)
      .values({ matchId: m.match.id, name, sortOrder })
      .returning();
    if (roundIds.length) {
      await db
        .insert(schema.matchTeamMembers)
        .values(roundIds.map((roundId) => ({ matchTeamId: created.id, roundId })));
    }
    return created;
  }

  // Another Match by the same creator on the same course as `m`.
  async function sibling(m: Match, date: string) {
    const [created] = await db
      .insert(schema.matches)
      .values({
        createdByPlayerId: m.creator.id,
        courseId: m.match.courseId,
        date: new Date(`${date}T00:00:00.000Z`),
      })
      .returning();
    return created;
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
      const m = await fixtures.match(4);
      const [a, b, c, d] = m.players.map((p) => p.round.id);
      const second = await team(m, "Team B", 1, [b, d]);
      const first = await team(m, "Team A", 0, [a, c]);
      const empty = await team(m, "Team C", 2, []);

      const match = await matches.getMatchById(m.match.id);

      expect(
        match?.teams.map((t) => ({ id: t.id, rounds: t.rounds.map((r) => r.id).sort() })),
      ).toEqual([
        { id: first.id, rounds: [a, c].sort() },
        { id: second.id, rounds: [b, d].sort() },
        { id: empty.id, rounds: [] },
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
