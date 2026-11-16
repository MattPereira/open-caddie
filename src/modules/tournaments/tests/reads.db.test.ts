import { describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import * as tournaments from "@/modules/tournaments/server";
import { createRoundFixtures } from "@/test/fixtures/rounds";

describe("Tournament reads", () => {
  const fixtures = createRoundFixtures(db, schema);

  type Tournament = Awaited<ReturnType<typeof fixtures.tournament>>;

  // Another Tournament in the same Season as `t`.
  async function sibling(t: Tournament, date: string) {
    const [created] = await db
      .insert(schema.tournaments)
      .values({
        seasonId: t.tournament.seasonId,
        date: new Date(`${date}T00:00:00.000Z`),
        courseId: t.course.id,
        teeId: t.tee.id,
      })
      .returning();
    return { ...t, tournament: created };
  }

  async function clubOf(t: Tournament) {
    const [club] = await db
      .select({ id: schema.clubs.id, handle: schema.clubs.handle })
      .from(schema.seasons)
      .innerJoin(schema.clubs, eq(schema.clubs.id, schema.seasons.clubId))
      .where(eq(schema.seasons.id, t.tournament.seasonId));
    return club;
  }

  async function named(firstName: string, lastName: string) {
    const [created] = await db
      .insert(schema.users)
      .values({
        email: `${crypto.randomUUID()}@example.com`,
        firstName,
        lastName,
      })
      .returning();
    return created;
  }

  function isoDaysFromToday(days: number) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  describe("by id", () => {
    it("is undefined for a missing Tournament", async () => {
      expect(
        await tournaments.getTournamentById(2_000_000_000),
      ).toBeUndefined();
    });

    it("carries the Club, Season and course, with its Rounds", async () => {
      const t = await fixtures.tournament();
      const a = await fixtures.tournamentPlayer(t);
      const b = await fixtures.tournamentPlayer(t);

      const tournament = await tournaments.getTournamentById(t.tournament.id);

      expect(tournament).toMatchObject({
        id: t.tournament.id,
        season: 1,
        seasonId: t.tournament.seasonId,
        courseId: t.course.id,
        courseHandle: t.course.handle,
        teeId: t.tee.id,
      });
      expect(tournament?.rounds.map((round) => round.id).sort()).toEqual(
        [a.round.id, b.round.id].sort(),
      );
    });

    it("lists every Round's Greenies by hole, closest first", async () => {
      const t = await fixtures.tournament();
      const a = await fixtures.tournamentPlayer(t);
      const b = await fixtures.tournamentPlayer(t);
      await db.insert(schema.roundScores).values([
        { roundId: a.round.id, hole: 3, strokes: 3 },
        { roundId: a.round.id, hole: 7, strokes: 3 },
        { roundId: b.round.id, hole: 3, strokes: 3 },
      ]);
      await db.insert(schema.greenies).values([
        { roundId: a.round.id, hole: 7, feet: 3, inches: 0 },
        { roundId: a.round.id, hole: 3, feet: 12, inches: 6 },
        { roundId: b.round.id, hole: 3, feet: 4, inches: 2 },
      ]);

      const tournament = await tournaments.getTournamentById(t.tournament.id);

      expect(tournament?.greenies).toMatchObject([
        { hole: 3, feet: 4, inches: 2 },
        { hole: 3, feet: 12, inches: 6 },
        { hole: 7, feet: 3, inches: 0 },
      ]);
    });
  });

  describe("lists", () => {
    it("lists every Tournament newest first, latest created first on a shared date, with its player count", async () => {
      const t = await fixtures.tournament();
      await fixtures.tournamentPlayer(t);
      await fixtures.tournamentPlayer(t);
      const later = await sibling(t, "2026-02-01");
      const sameDay = await sibling(t, "2026-02-01");
      const otherClub = await fixtures.tournament();

      const all = await tournaments.getAllTournaments();

      expect(all.map(({ id, playerCount }) => ({ id, playerCount }))).toEqual([
        { id: sameDay.tournament.id, playerCount: 0 },
        { id: later.tournament.id, playerCount: 0 },
        { id: otherClub.tournament.id, playerCount: 0 },
        { id: t.tournament.id, playerCount: 2 },
      ]);
    });

    it("lists only one Club's Tournaments by its handle", async () => {
      const t = await fixtures.tournament();
      const later = await sibling(t, "2026-02-01");
      await fixtures.tournament();

      const byClub = await tournaments.getTournamentsByClubHandle(
        (await clubOf(t)).handle,
      );

      expect(byClub.map((row) => row.id)).toEqual([
        later.tournament.id,
        t.tournament.id,
      ]);
    });
  });

  describe("upcoming for a player", () => {
    it("lists today's and later Tournaments of the player's Clubs, soonest first", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.player();
      await db
        .insert(schema.clubMembers)
        .values({ clubId: (await clubOf(t)).id, playerId: player.id });
      await sibling(t, isoDaysFromToday(-1));
      const today = await sibling(t, isoDaysFromToday(0));
      const soon = await sibling(t, isoDaysFromToday(7));
      const elsewhere = await fixtures.tournament();
      await sibling(elsewhere, isoDaysFromToday(3));

      const upcoming = await tournaments.getUpcomingTournamentsForPlayer(
        player.id,
      );

      expect(upcoming.map((row) => row.id)).toEqual([
        today.tournament.id,
        soon.tournament.id,
      ]);
    });
  });

  describe("addable players", () => {
    it("lists players without a Round in the Tournament, by name", async () => {
      const t = await fixtures.tournament();
      const entered = await fixtures.tournamentPlayer(t);
      const elsewhere = await fixtures.tournamentPlayer(
        await fixtures.tournament(),
      );
      const zed = await named("Zed", "Adams");
      const amy = await named("Amy", "Young");

      const addable = await tournaments.getAddablePlayersForTournament(
        t.tournament.id,
      );
      const ids = addable.map((player) => player.id);

      expect(ids).not.toContain(entered.player.id);
      expect(ids).toContain(elsewhere.player.id);
      expect(ids.indexOf(amy.id)).toBeLessThan(ids.indexOf(zed.id));
    });

    it("lists no one for a missing Tournament", async () => {
      await fixtures.player();

      expect(
        await tournaments.getAddablePlayersForTournament(2_000_000_000),
      ).toEqual([]);
    });
  });
});
