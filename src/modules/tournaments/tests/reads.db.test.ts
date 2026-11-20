import { describe, expect, it } from "vitest";

import * as tournaments from "@/modules/tournaments/server";
import { createFixtures } from "@/test/fixtures";

describe("Tournament reads", () => {
  const fixtures = createFixtures();

  type Tournament = Awaited<ReturnType<typeof fixtures.tournament>>;

  // Another Tournament in the same Season as `t`.
  async function sibling(t: Tournament, date: string) {
    return fixtures.tournament({
      club: t.club,
      seasonId: t.tournament.seasonId,
      date,
    });
  }

  const named = (firstName: string, lastName: string) =>
    fixtures.player({ firstName, lastName });

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
      await fixtures.scores(a.round.id, [
        { hole: 3, strokes: 3 },
        { hole: 7, strokes: 3 },
      ]);
      await fixtures.scores(b.round.id, [{ hole: 3, strokes: 3 }]);
      await fixtures.greenie(a.round.id, 7, { feet: 3, inches: 0 });
      await fixtures.greenie(a.round.id, 3, { feet: 12, inches: 6 });
      await fixtures.greenie(b.round.id, 3, { feet: 4, inches: 2 });

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
        t.club.handle,
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
      await fixtures.clubMember(t.club.id, player.id);
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
