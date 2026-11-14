import { describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { createRoundFixtures, PAR_THREE_HOLES } from "@/lib/rounds/test-fixtures";
import * as standings from "../index";

describe("Season Standings read", () => {
  const fixtures = createRoundFixtures(db, schema);

  type Course = Awaited<ReturnType<typeof fixtures.course>>;
  type Player = Awaited<ReturnType<typeof fixtures.player>>;

  const pointRules = {
    participation: 10,
    pars: 1,
    birdies: 3,
    eagles: 5,
    aces: 10,
    strokes: { positions: [20, 10, 5] },
    putts: { positions: [8, 4] },
    greenies: {
      tiers: [
        { maxFt: 3, pts: 6 },
        { maxFt: 10, pts: 3 },
        { maxFt: null, pts: 1 },
      ],
    },
  };

  function par(hole: number) {
    return PAR_THREE_HOLES.includes(hole) ? 3 : 4;
  }

  async function club() {
    const t = await fixtures.tournament();
    const [season] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.id, t.tournament.seasonId));
    await db
      .update(schema.clubs)
      .set({ pointRules })
      .where(eq(schema.clubs.id, season.clubId));
    return { t, clubId: season.clubId };
  }

  async function tournament(
    seasonId: number,
    { course, tee }: Course,
    date: string,
  ) {
    const [created] = await db
      .insert(schema.tournaments)
      .values({
        seasonId,
        date: new Date(`${date}T00:00:00.000Z`),
        courseId: course.id,
        teeId: tee.id,
      })
      .returning();
    return created;
  }

  async function enter(
    t: typeof schema.tournaments.$inferSelect,
    player: Player,
  ) {
    const [round] = await db
      .insert(schema.rounds)
      .values({
        tournamentId: t.id,
        playerId: player.id,
        courseId: t.courseId,
        teeId: t.teeId,
        date: t.date,
      })
      .returning();
    return round;
  }

  // Strokes per hole default to par; holes not listed in `holes` are left
  // unplayed when `holes` is given.
  async function card(
    roundId: number,
    {
      strokes = {},
      putts = () => 2,
      holes = 18,
    }: {
      strokes?: Record<number, number> | ((hole: number) => number);
      putts?: (hole: number) => number | null;
      holes?: number;
    } = {},
  ) {
    const strokesFor = (hole: number) =>
      typeof strokes === "function" ? strokes(hole) : (strokes[hole] ?? par(hole));
    await db.insert(schema.roundScores).values(
      Array.from({ length: holes }, (_, index) => ({
        roundId,
        hole: index + 1,
        strokes: strokesFor(index + 1),
        putts: putts(index + 1),
      })),
    );
  }

  async function greenie(roundId: number, hole: number, feet: number, inches: number) {
    await db.insert(schema.greenies).values({ roundId, hole, feet, inches });
  }

  function points(values: Partial<Record<string, number>> & { total: number }) {
    return {
      participation: 0,
      strokes: 0,
      putts: 0,
      greenies: 0,
      pars: 0,
      birdies: 0,
      eagles: 0,
      aces: 0,
      ...values,
    };
  }

  it("scores a Season across several Tournaments and courses", async () => {
    const { t, clubId } = await club();
    const courseA = { course: t.course, tee: t.tee };
    const courseB = await fixtures.course();
    const seasonId = t.tournament.seasonId;
    const first = t.tournament;
    const second = await tournament(seasonId, courseB, "2026-02-01");
    const fillers = [];
    for (let day = 1; day <= 9; day += 1) {
      fillers.push(await tournament(seasonId, courseA, `2025-12-0${day}`));
    }
    const x = await fixtures.player();
    const y = await fixtures.player();
    const z = await fixtures.player();

    // First Tournament: x pars every hole; y aces 3 and birdies 7;
    // z stops after 9 holes with an eagle on 1.
    const x1 = await enter(first, x);
    await card(x1.id);
    await greenie(x1.id, 7, 8, 6);
    const y1 = await enter(first, y);
    await card(y1.id, {
      strokes: (hole) => (hole === 3 ? 1 : hole === 7 ? 2 : 5),
      putts: (hole) => (hole === 3 ? 0 : 1),
    });
    await greenie(y1.id, 12, 15, 0);
    const z1 = await enter(first, z);
    await card(z1.id, { strokes: { 1: 2 }, holes: 9 });
    await greenie(z1.id, 3, 2, 0);

    // Second Tournament: x shoots 5s with no putt on 18; y birdies 1.
    const x2 = await enter(second, x);
    await card(x2.id, {
      strokes: () => 5,
      putts: (hole) => (hole === 18 ? null : 2),
    });
    const y2 = await enter(second, y);
    await card(y2.id, { strokes: { 1: 3 } });

    // x enters 9 more Tournaments without a score: participation only.
    const fillerRounds = [];
    for (const filler of fillers) fillerRounds.push(await enter(filler, x));

    const read = await standings.getSeasonStandings({ clubId, season: 1 });

    expect(read).toMatchObject({
      club: { id: clubId },
      season: 1,
      countedRoundLimit: 10,
      pointRules,
    });
    expect(read?.tournaments.map((tt) => tt.id)).toEqual([
      second.id,
      first.id,
      ...fillers.map((f) => f.id).reverse(),
    ]);

    const [secondRead, firstRead] = read!.tournaments;
    expect(firstRead).toMatchObject({
      courseHandle: courseA.course.handle,
      season: 1,
    });
    expect(secondRead.courseHandle).toBe(courseB.course.handle);

    expect(
      firstRead.rounds.map((round) => ({
        roundId: round.id,
        courseHandle: round.courseHandle,
        totalStrokes: round.totalStrokes,
        totalPutts: round.totalPutts,
        isComplete: round.isComplete,
        playerIndex: round.playerIndex,
        netStrokes: round.netStrokes,
        points: round.points,
      })),
    ).toEqual([
      {
        roundId: x1.id,
        courseHandle: courseA.course.handle,
        totalStrokes: 68,
        totalPutts: 36,
        isComplete: true,
        playerIndex: null,
        netStrokes: 68,
        points: points({
          participation: 10,
          strokes: 20,
          putts: 4,
          greenies: 3,
          pars: 18,
          total: 55,
        }),
      },
      {
        roundId: y1.id,
        courseHandle: courseA.course.handle,
        totalStrokes: 83,
        totalPutts: 17,
        isComplete: true,
        playerIndex: null,
        netStrokes: 83,
        // The hole in one earns ace points only, not eagle points too.
        points: points({
          participation: 10,
          strokes: 10,
          putts: 8,
          greenies: 1,
          birdies: 3,
          aces: 10,
          total: 42,
        }),
      },
      {
        roundId: z1.id,
        courseHandle: courseA.course.handle,
        totalStrokes: 32,
        totalPutts: 18,
        isComplete: false,
        playerIndex: null,
        netStrokes: null,
        // Incomplete: no position points, but scoring and Greenie points.
        points: points({
          participation: 10,
          greenies: 6,
          pars: 8,
          eagles: 5,
          total: 29,
        }),
      },
    ]);

    expect(
      secondRead.rounds.map((round) => ({
        roundId: round.id,
        courseHandle: round.courseHandle,
        netStrokes: round.netStrokes,
        points: round.points,
      })),
    ).toEqual([
      {
        roundId: y2.id,
        courseHandle: courseB.course.handle,
        netStrokes: 67,
        points: points({
          participation: 10,
          strokes: 20,
          putts: 8,
          pars: 17,
          birdies: 3,
          total: 58,
        }),
      },
      {
        roundId: x2.id,
        courseHandle: courseB.course.handle,
        netStrokes: 90,
        // Putts missing on one hole: no Putts position points.
        points: points({ participation: 10, strokes: 10, total: 20 }),
      },
    ]);

    expect(
      read?.players.map((standing) => ({
        position: standing.position,
        playerId: standing.playerId,
        roundsPlayed: standing.roundsPlayed,
        countedRounds: standing.countedRounds,
        droppedRounds: standing.droppedRounds,
        total: standing.points.total,
      })),
    ).toEqual([
      { position: 1, playerId: x.id, roundsPlayed: 11, countedRounds: 10, droppedRounds: 1, total: 155 },
      { position: 2, playerId: y.id, roundsPlayed: 2, countedRounds: 2, droppedRounds: 0, total: 100 },
      { position: 3, playerId: z.id, roundsPlayed: 1, countedRounds: 1, droppedRounds: 0, total: 29 },
    ]);

    // Equal-point Rounds are counted in Round order, so the last one drops.
    const dropped = fillerRounds.at(-1)!;
    expect(
      read?.players[0].roundBreakdown.map((round) => [round.id, round.counted]),
    ).toEqual([
      [x1.id, true],
      [x2.id, true],
      ...fillerRounds.map((round) => [round.id, round.id !== dropped.id]),
    ]);
    expect(read?.players[0].points).toEqual(
      points({
        participation: 100,
        strokes: 30,
        putts: 4,
        greenies: 3,
        pars: 18,
        total: 155,
      }),
    );
  });

  it("builds the Player Index from earlier Seasons of the same Club only", async () => {
    const { t, clubId } = await club();
    const course = { course: t.course, tee: t.tee };
    const player = await fixtures.player();
    const prior1 = await enter(
      await tournament(t.tournament.seasonId, course, "2025-02-01"),
      player,
    );
    await card(prior1.id, { strokes: (hole) => (hole === 18 ? 8 : 4) }); // 76
    const prior2 = await enter(
      await tournament(t.tournament.seasonId, course, "2025-03-01"),
      player,
    );
    await card(prior2.id, { strokes: (hole) => (hole === 18 ? 10 : 4) }); // 78
    // A better Round for another Club must not count.
    const elsewhere = await fixtures.tournament();
    const otherClubRound = await enter(
      await tournament(elsewhere.tournament.seasonId, elsewhere, "2025-04-01"),
      player,
    );
    await card(otherClubRound.id, { strokes: () => 4 }); // 72

    const [season2] = await db
      .insert(schema.seasons)
      .values({ clubId, number: 2 })
      .returning();
    const current = await enter(
      await tournament(season2.id, course, "2026-03-01"),
      player,
    );
    await card(current.id, { strokes: (hole) => (hole === 18 ? 12 : 4) }); // 80

    const read = await standings.getSeasonStandings({ clubId, season: 2 });

    expect(read?.tournaments).toHaveLength(1);
    const [round] = read!.tournaments[0].rounds;
    expect(round.id).toBe(current.id);
    // Differentials of the 76 and 78 on a 72 / slope 120 tee average to
    // 4.71, a Playing Handicap of 5.
    expect(round.playerIndex).toBeCloseTo(4.708, 3);
    expect(round.netStrokes).toBeCloseTo(75);
  });

  it("builds the Player Index from the best 2 of the last 4 prior Rounds", async () => {
    const { t, clubId } = await club();
    const course = { course: t.course, tee: t.tee };
    const player = await fixtures.player();
    // Oldest first. The 72 is the best Round but falls outside the last 4.
    const grosses = [72, 80, 77, 84, 79];
    for (const [index, gross] of grosses.entries()) {
      const prior = await enter(
        await tournament(t.tournament.seasonId, course, `2025-0${index + 2}-01`),
        player,
      );
      await card(prior.id, { strokes: (hole) => (hole === 18 ? gross - 68 : 4) });
    }

    const [season2] = await db
      .insert(schema.seasons)
      .values({ clubId, number: 2 })
      .returning();
    const current = await enter(
      await tournament(season2.id, course, "2026-03-01"),
      player,
    );
    await card(current.id, { strokes: (hole) => (hole === 18 ? 12 : 4) }); // 80

    const read = await standings.getSeasonStandings({ clubId, season: 2 });

    const [round] = read!.tournaments[0].rounds;
    // The 77 and 79 (differentials 4.71 and 6.59) average to 5.65, a
    // Playing Handicap of 6.
    expect(round.playerIndex).toBeCloseTo(5.65, 3);
    expect(round.playingHandicap).toBeCloseTo(6);
    expect(round.netStrokes).toBeCloseTo(74);
  });

  it("feeds earlier Rounds of the same Season into a later Round's Player Index", async () => {
    const { t, clubId } = await club();
    const course = { course: t.course, tee: t.tee };
    const seasonId = t.tournament.seasonId;
    const player = await fixtures.player();
    const first = await enter(await tournament(seasonId, course, "2025-02-01"), player);
    await card(first.id, { strokes: (hole) => (hole === 18 ? 8 : 4) }); // 76
    const second = await enter(await tournament(seasonId, course, "2025-03-01"), player);
    await card(second.id, { strokes: (hole) => (hole === 18 ? 10 : 4) }); // 78
    const third = await enter(await tournament(seasonId, course, "2025-04-01"), player);
    await card(third.id, { strokes: (hole) => (hole === 18 ? 12 : 4) }); // 80

    const read = await standings.getSeasonStandings({ clubId, season: 1 });

    const rounds = new Map(
      read!.tournaments
        .flatMap((tt) => tt.rounds)
        .map((round) => [round.id, round]),
    );
    // Fewer than 2 prior Rounds: scratch.
    expect(rounds.get(first.id)).toMatchObject({ playerIndex: null, netStrokes: 76 });
    expect(rounds.get(second.id)).toMatchObject({ playerIndex: null, netStrokes: 78 });
    expect(rounds.get(third.id)?.playerIndex).toBeCloseTo(4.708, 3);
    expect(rounds.get(third.id)?.netStrokes).toBeCloseTo(75);
  });

  it("reads only the given Club's Tournaments and Rounds", async () => {
    const { t, clubId } = await club();
    const own = await fixtures.tournamentPlayer(t);
    // Another Club with its own Season 1 on the same date.
    await fixtures.tournamentPlayer(await fixtures.tournament());

    const read = await standings.getSeasonStandings({ clubId, season: 1 });

    expect(read?.tournaments.map((tt) => tt.id)).toEqual([t.tournament.id]);
    expect(read?.players.map((p) => p.playerId)).toEqual([own.player.id]);
  });

  it("orders same-day Tournaments newest-created first", async () => {
    const { t, clubId } = await club();
    const sameDay = await tournament(
      t.tournament.seasonId,
      { course: t.course, tee: t.tee },
      "2026-01-01",
    );

    const read = await standings.getSeasonStandings({ clubId, season: 1 });

    expect(read?.tournaments.map((tt) => tt.id)).toEqual([
      sameDay.id,
      t.tournament.id,
    ]);
  });

  it("returns empty Standings for a Season with no Tournaments", async () => {
    const { t, clubId } = await club();
    await db
      .delete(schema.tournaments)
      .where(eq(schema.tournaments.id, t.tournament.id));

    const read = await standings.getSeasonStandings({ clubId, season: 1 });

    expect(read).toMatchObject({
      club: { id: clubId },
      season: 1,
      countedRoundLimit: 10,
      tournaments: [],
      players: [],
    });
  });

  it("returns nothing for an unknown Club", async () => {
    expect(await standings.getSeasonStandings({ clubId: -1, season: 1 })).toBeNull();
  });
});

describe("Club Seasons read", () => {
  const fixtures = createRoundFixtures(db, schema);

  it("lists the Club's Seasons with Tournaments, newest first, once each", async () => {
    const t = await fixtures.tournament();
    const course = { course: t.course, tee: t.tee };
    const [season1] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.id, t.tournament.seasonId));
    const clubId = season1.clubId;
    const [season2] = await db
      .insert(schema.seasons)
      .values([
        { clubId, number: 2 },
        // No Tournaments: not listed.
        { clubId, number: 3 },
      ])
      .returning();
    await db.insert(schema.tournaments).values([
      { seasonId: season1.id, date: new Date("2026-02-01"), courseId: course.course.id, teeId: course.tee.id },
      { seasonId: season2.id, date: new Date("2026-03-01"), courseId: course.course.id, teeId: course.tee.id },
    ]);
    // Another Club's Season must not leak in.
    const other = await fixtures.tournament();
    await db
      .update(schema.seasons)
      .set({ number: 5 })
      .where(eq(schema.seasons.id, other.tournament.seasonId));

    expect(await standings.getClubSeasons(clubId)).toEqual([
      { season: 2 },
      { season: 1 },
    ]);
  });
});
