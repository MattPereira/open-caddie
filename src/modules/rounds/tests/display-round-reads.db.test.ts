import { describe, expect, it } from "vitest";

import { createFixtures } from "@/test/fixtures";
import {
  changeRoundSettings,
  getMatchRounds,
  getRoundById,
  getTournamentRounds,
} from "../server";

describe("Display Round reads", () => {
  const fixtures = createFixtures();

  type Tournament = Awaited<ReturnType<typeof fixtures.tournament>>;

  type Player = Awaited<ReturnType<typeof fixtures.player>>;

  // Fixture tees are rated 72, so with their slope a Round's Score
  // Differential scales back to (strokes - 72) as a Course Handicap.
  async function card(roundId: number, totalStrokes: number) {
    await fixtures.scores(
      roundId,
      Array.from({ length: 18 }, (_, index) => ({
        hole: index + 1,
        strokes: index === 17 ? totalStrokes - 68 : 4,
        putts: 2,
      })),
    );
  }

  async function casualRound() {
    const { course, tee } = await fixtures.course();
    const player = await fixtures.player();
    const id = await fixtures.casualRound(player.id, {
      courseHandle: course.handle,
      teeId: tee.id,
    });
    return { id };
  }

  // A complete Round for `player` in another Tournament of the same Club.
  async function priorRound(
    t: Tournament,
    player: Player,
    date: string,
    totalStrokes: number,
  ) {
    const other = await fixtures.tournament({
      club: t.club,
      seasonId: t.tournament.seasonId,
      date,
      on: t,
    });
    const { round } = await fixtures.tournamentPlayer(other, player);
    await card(round.id, totalStrokes);
    return round;
  }

  async function settings(
    roundId: number,
    change: Parameters<typeof changeRoundSettings>[2],
  ) {
    const result = await changeRoundSettings(
      await fixtures.admin(),
      roundId,
      change,
    );
    if (!result.ok) throw new Error(result.error);
  }

  describe("kind", () => {
    it("tags Tournament Rounds, without a Player Index Override", async () => {
      const t = await fixtures.tournament();
      const { round } = await fixtures.tournamentPlayer(t);

      const { rounds } = await getTournamentRounds(t.tournament.id);

      expect(rounds).toHaveLength(1);
      expect(rounds[0]).toMatchObject({
        id: round.id,
        kind: "tournament",
        tournamentId: t.tournament.id,
      });
      expect(rounds[0]).not.toHaveProperty("playerIndexOverride");
    });

    it("tags Match Rounds, with their Player Index Override", async () => {
      const { match, players } = await fixtures.match(1);
      await settings(players[0].round.id, { playerIndexOverride: 8.4 });

      const { rounds } = await getMatchRounds(match.id);

      expect(rounds).toMatchObject([
        { kind: "match", matchId: match.id, playerIndexOverride: 8.4 },
      ]);
    });

    it("tags a single Round by its event", async () => {
      const t = await fixtures.tournament();
      const { round: tournamentRound } = await fixtures.tournamentPlayer(t);
      const { players } = await fixtures.match(1);
      const casual = await casualRound();

      const [tournament, match, single] = await Promise.all([
        getRoundById(tournamentRound.id),
        getRoundById(players[0].round.id),
        getRoundById(casual.id),
      ]);

      expect(tournament?.kind).toBe("tournament");
      expect(match).toMatchObject({
        kind: "match",
        playerIndexOverride: null,
      });
      expect(single?.kind).toBe("casual");
      expect(single).not.toHaveProperty("playerIndexOverride");
      expect(await getRoundById(-1)).toBeUndefined();
    });
  });

  describe("Tournament Playing Handicap", () => {
    it("plays scratch with fewer than 2 prior Rounds", async () => {
      const t = await fixtures.tournament();
      const { player, round } = await fixtures.tournamentPlayer(t);
      await priorRound(t, player, "2025-06-01", 90);
      await card(round.id, 80);

      const { rounds } = await getTournamentRounds(t.tournament.id);

      expect(rounds[0]).toMatchObject({ playingHandicap: 0, netStrokes: 80 });
    });

    it("uses the best 2 of the last 4 prior Rounds", async () => {
      const t = await fixtures.tournament();
      const { player, round } = await fixtures.tournamentPlayer(t);
      // The oldest, and best, Round falls outside the last 4.
      await priorRound(t, player, "2025-01-01", 70);
      await priorRound(t, player, "2025-02-01", 82);
      await priorRound(t, player, "2025-03-01", 78);
      await priorRound(t, player, "2025-04-01", 90);
      await priorRound(t, player, "2025-05-01", 76);
      await card(round.id, 80);

      const [only] = (await getTournamentRounds(t.tournament.id)).rounds;

      // Best two of 82, 78, 90, 76 are 76 and 78: (4 + 6) / 2.
      expect(only.playingHandicap).toBeCloseTo(5);
      expect(only.netStrokes).toBeCloseTo(75);
    });

    it("counts prior Rounds only from the same Club and earlier dates", async () => {
      const t = await fixtures.tournament();
      const { player } = await fixtures.tournamentPlayer(t);
      await priorRound(t, player, "2025-02-01", 80);
      await priorRound(t, player, "2025-03-01", 84);
      // Neither of these may count: one is after the event, one elsewhere.
      await priorRound(t, player, "2026-02-01", 72);
      const elsewhere = await fixtures.tournament({
        date: "2025-04-01",
        on: t,
      });
      const { round: otherClubRound } = await fixtures.tournamentPlayer(
        elsewhere,
        player,
      );
      await card(otherClubRound.id, 72);

      const [only] = (await getTournamentRounds(t.tournament.id)).rounds;

      expect(only.playingHandicap).toBeCloseTo(10);
    });

    it("gives each player of the field what they get read alone", async () => {
      const t = await fixtures.tournament();
      const a = await fixtures.tournamentPlayer(t);
      const b = await fixtures.tournamentPlayer(t);
      const c = await fixtures.tournamentPlayer(t);
      await priorRound(t, a.player, "2025-02-01", 76);
      await priorRound(t, a.player, "2025-03-01", 78);
      await priorRound(t, b.player, "2025-02-01", 90);
      await priorRound(t, b.player, "2025-03-01", 86);
      await priorRound(t, b.player, "2025-04-01", 94);
      await card(a.round.id, 80);
      await card(b.round.id, 95);

      const { rounds } = await getTournamentRounds(t.tournament.id);
      const handicaps = Object.fromEntries(
        rounds.map((round) => [round.id, round.playingHandicap]),
      );

      expect(handicaps[a.round.id]).toBeCloseTo(5);
      expect(handicaps[b.round.id]).toBeCloseTo(16);
      expect(handicaps[c.round.id]).toBe(0);
      for (const { round } of [a, b, c]) {
        const alone = await getRoundById(round.id);
        expect(alone?.playingHandicap).toBeCloseTo(handicaps[round.id]);
      }
    });
  });

  describe("Match Playing Handicap", () => {
    it("comes from the Player Index Override, or scratch without one", async () => {
      const { match, players } = await fixtures.match(2);
      const [withOverride, without] = players;
      await settings(withOverride.round.id, { playerIndexOverride: 11.3 });
      await card(withOverride.round.id, 90);
      await card(without.round.id, 90);

      const { rounds } = await getMatchRounds(match.id);
      const byId = new Map(rounds.map((round) => [round.id, round]));

      // 11.3 on a slope 120 tee: 11.3 * 120 / 113 = 12.
      expect(byId.get(withOverride.round.id)?.playingHandicap).toBeCloseTo(12);
      expect(byId.get(withOverride.round.id)?.netStrokes).toBeCloseTo(78);
      expect(byId.get(without.round.id)).toMatchObject({
        playingHandicap: 0,
        netStrokes: 90,
      });
    });
  });

  it("applies no Playing Handicap to a casual Round", async () => {
    const round = await casualRound();
    await card(round.id, 85);

    const read = await getRoundById(round.id);

    expect(read).toMatchObject({
      totalStrokes: 85,
      isComplete: true,
      playingHandicap: null,
      netStrokes: null,
    });
  });

  it("sorts by net, then gross, then name, with no net strokes last", async () => {
    const t = await fixtures.tournament();
    const players = [];
    for (const lastName of [
      "Incomplete",
      "Bravo",
      "Alpha",
      "Handicap",
      "Low",
    ]) {
      players.push(
        await fixtures.tournamentPlayer(t, await fixtures.player({ lastName })),
      );
    }
    const [incomplete, bravo, alpha, handicap, low] = players;
    await fixtures.scores(incomplete.round.id, [{ hole: 1, strokes: 3 }]);
    await card(bravo.round.id, 77);
    await card(alpha.round.id, 77);
    // Net 75 off gross 80 ranks behind a scratch 75.
    await priorRound(t, handicap.player, "2025-02-01", 76);
    await priorRound(t, handicap.player, "2025-03-01", 78);
    await card(handicap.round.id, 80);
    await card(low.round.id, 75);

    const { rounds } = await getTournamentRounds(t.tournament.id);

    expect(rounds.map((round) => round.lastName)).toEqual([
      "Low",
      "Handicap",
      "Alpha",
      "Bravo",
      "Incomplete",
    ]);
  });

  it("carries each Round's per-hole scores and Greenies", async () => {
    const { match, players } = await fixtures.match(2);
    const mate = players[1];
    await fixtures.scores(mate.round.id, [
      { hole: 1, strokes: 5, putts: 2 },
      { hole: 3, strokes: 3, putts: 1 },
    ]);
    await fixtures.greenie(mate.round.id, 3, { feet: 12, inches: 6 });

    const { rounds } = await getMatchRounds(match.id);

    expect(rounds.find((round) => round.id === mate.round.id)).toMatchObject({
      playerId: mate.player.id,
      scores: [
        { hole: 1, par: 4, strokes: 5, putts: 2 },
        { hole: 3, par: 3, strokes: 3, putts: 1 },
      ],
      greenies: [{ hole: 3, feet: 12, inches: 6 }],
    });
  });

  describe("course data", () => {
    async function yardage(
      t: Tournament,
      teeId: number,
      firstHoleYards: number,
    ) {
      await fixtures.yardages(
        t.course.handle,
        teeId,
        Array.from({ length: 18 }, (_, index) => firstHoleYards + index),
      );
    }

    it("returns holes with par and handicap, and tees with total yards", async () => {
      const t = await fixtures.tournament();
      const white = await fixtures.tee(t.course.handle);
      await yardage(t, t.tee.id, 400);

      const { course } = await getTournamentRounds(t.tournament.id);

      expect(course.holes).toHaveLength(18);
      expect(course.holes[0]).toEqual({ hole: 1, par: 4, handicap: 1 });
      expect(course.holes[2]).toEqual({ hole: 3, par: 3, handicap: 3 });
      // 400 + 401 + ... + 417.
      expect(course.tees).toMatchObject([
        { id: t.tee.id, name: "Blue", totalYards: 7353 },
        { id: white.id, name: "White", totalYards: null },
      ]);
    });

    it("gives each Round the yards of its own tee", async () => {
      const t = await fixtures.tournament();
      const white = await fixtures.tee(t.course.handle);
      await yardage(t, t.tee.id, 400);
      await yardage(t, white.id, 300);
      const blue = await fixtures.tournamentPlayer(t);
      const onWhite = await fixtures.tournamentPlayer(t);
      await settings(onWhite.round.id, { teeId: white.id });

      const { rounds } = await getTournamentRounds(t.tournament.id);
      const byId = new Map(rounds.map((round) => [round.id, round]));

      expect(byId.get(blue.round.id)?.yards).toHaveLength(18);
      expect(byId.get(blue.round.id)?.yards[0]).toEqual({
        hole: 1,
        yards: 400,
      });
      expect(byId.get(onWhite.round.id)?.yards).toHaveLength(18);
      expect(byId.get(onWhite.round.id)?.yards[17]).toEqual({
        hole: 18,
        yards: 317,
      });
    });

    it("still has the course for an event with no Rounds", async () => {
      const { match } = await fixtures.match(0);

      const read = await getMatchRounds(match.id);

      expect(read.rounds).toEqual([]);
      expect(read.course.holes).toHaveLength(18);
      expect(read.course.tees).toHaveLength(1);
    });
  });

  describe("handicap details", () => {
    it("marks which prior Rounds were used for the Player Index", async () => {
      const t = await fixtures.tournament();
      const { player, round } = await fixtures.tournamentPlayer(t);
      const used76 = await priorRound(t, player, "2025-02-01", 76);
      const unused90 = await priorRound(t, player, "2025-03-01", 90);
      const used78 = await priorRound(t, player, "2025-04-01", 78);

      const read = await getRoundById(round.id, true);
      const details = read?.handicapDetails;

      expect(
        details?.priorRounds.map((prior) => [
          prior.id,
          prior.usedForPlayerIndex,
        ]),
      ).toEqual([
        [used78.id, true],
        [unused90.id, false],
        [used76.id, true],
      ]);
      expect(details?.priorRounds[0]).toMatchObject({
        courseHandle: t.course.handle,
        totalStrokes: 78,
      });
      // Differentials (113 / 120) * 4 and (113 / 120) * 6, averaged.
      expect(details?.playerIndex).toBeCloseTo((113 / 120) * 5);
      expect(details?.courseHandicap).toBeCloseTo(5);
    });

    it("has none for Match and casual Rounds, or when not asked for", async () => {
      const t = await fixtures.tournament();
      const { round } = await fixtures.tournamentPlayer(t);
      const { players } = await fixtures.match(1);
      const casual = await casualRound();

      const [match, single, unasked] = await Promise.all([
        getRoundById(players[0].round.id, true),
        getRoundById(casual.id, true),
        getRoundById(round.id),
      ]);

      expect(match?.handicapDetails).toBeNull();
      expect(single?.handicapDetails).toBeNull();
      expect(unasked?.handicapDetails).toBeNull();
    });
  });
});
