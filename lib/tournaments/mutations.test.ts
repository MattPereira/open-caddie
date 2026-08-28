import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

const getCurrentUser = vi.hoisted(() =>
  vi.fn(async (): Promise<{ isAdmin: boolean } | null> => ({ isAdmin: true })),
);
vi.mock("@/lib/users/queries", () => ({ getCurrentUser }));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe.skip("Tournament Season mutations", () => {
    it("requires TEST_DATABASE_URL", () => {});
  });
} else {
  describe("Tournament Season mutations", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.DATABASE_DRIVER = "node-postgres";
    const [{ db }, schema, actions, standings, queries, clubQueries] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("@/app/(app)/tournaments/actions"),
      import("@/lib/clubs/standings/queries"),
      import("./queries"),
      import("@/lib/clubs/queries"),
    ]);
    const { desc, eq } = await import("drizzle-orm");
    const clubIds: number[] = [];
    const courseIds: number[] = [];

    async function fixture() {
      const suffix = crypto.randomUUID();
      const [club] = await db.insert(schema.clubs).values({
        handle: `club-${suffix}`,
        name: `Club ${suffix}`,
        pointRules: { participation: 0, pars: 0, birdies: 0, eagles: 0, aces: 0, strokes: { positions: [0] }, putts: { positions: [0] }, greenies: { tiers: [{ maxFt: null, pts: 0 }] } },
      }).returning();
      const [course] = await db.insert(schema.courses).values({ handle: `course-${suffix}`, name: `Course ${suffix}` }).returning();
      const [tee] = await db.insert(schema.courseTees).values({ courseId: course.id, name: "Blue", rating: "72", slope: 120 }).returning();
      clubIds.push(club.id);
      courseIds.push(course.id);
      return { club, course, tee };
    }

    async function create(f: Awaited<ReturnType<typeof fixture>>, input: { seasonId?: number; startNextSeason?: boolean; date?: string } = {}) {
      const result = await actions.createTournament({
        clubHandle: f.club.handle,
        seasonId: input.seasonId ?? "",
        startNextSeason: input.startNextSeason ?? false,
        date: input.date ?? "2026-01-01",
        courseHandle: f.course.handle,
        teeId: f.tee.id,
      });
      if (!result.ok || result.id == null) throw new Error(result.ok ? "Missing Tournament id" : result.error);
      const [tournament] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, result.id));
      return tournament;
    }

    afterEach(async () => {
      const { inArray } = await import("drizzle-orm");
      if (clubIds.length) {
        const clubSeasonIds = (await db.select({ id: schema.seasons.id }).from(schema.seasons).where(inArray(schema.seasons.clubId, clubIds))).map((season) => season.id);
        if (clubSeasonIds.length) await db.delete(schema.tournaments).where(inArray(schema.tournaments.seasonId, clubSeasonIds));
        await db.delete(schema.clubs).where(inArray(schema.clubs.id, clubIds));
      }
      if (courseIds.length) await db.delete(schema.courses).where(inArray(schema.courses.id, courseIds));
      clubIds.length = 0;
      courseIds.length = 0;
    });

    it("creates Season 1 for a Club's first Tournament", async () => {
      const { club, course, tee } = await fixture();
      const f = { club, course, tee };
      const tournament = await create(f);
      const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, tournament.seasonId));
      expect(season).toMatchObject({ clubId: club.id, number: 1 });
      expect(await queries.getTournamentById(tournament.id)).toMatchObject({ clubId: club.id, season: 1, seasonId: season.id });
      expect(await queries.getAllTournaments()).toContainEqual(expect.objectContaining({ id: tournament.id, clubId: club.id, season: 1 }));
    });

    it("atomically starts the next Season with its Tournament", async () => {
      const { club, course, tee } = await fixture();
      const f = { club, course, tee };
      await create(f);
      const tournament = await create(f, { startNextSeason: true, date: "2025-01-01" });
      const clubSeasons = await db.select().from(schema.seasons).where(eq(schema.seasons.clubId, club.id)).orderBy(schema.seasons.number);
      expect(clubSeasons.map(({ number }) => number)).toEqual([1, 2]);
      expect(tournament.seasonId).toBe(clubSeasons[1].id);
    });

    it("reassigns a Tournament through its Season regardless of date", async () => {
      const { club, course, tee } = await fixture();
      const f = { club, course, tee };
      const first = await create(f, { date: "2030-01-01" });
      const second = await create(f, { startNextSeason: true, date: "2020-01-01" });
      const [seasonOne] = await db.select().from(schema.seasons).where(eq(schema.seasons.clubId, club.id)).orderBy(schema.seasons.number);
      const update = await actions.updateTournament({ id: second.id, clubHandle: club.handle, seasonId: seasonOne.id, startNextSeason: false, date: "2010-01-01", courseHandle: course.handle, teeId: tee.id });
      expect(update.ok).toBe(true);
      const [updated] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, second.id));
      expect(updated).toMatchObject({ seasonId: seasonOne.id });
      expect(await queries.getTournamentById(second.id)).toMatchObject({ clubId: club.id, season: 1 });
      expect(first.id).toBeTypeOf("number");
    });

    it("defaults a new Tournament to the Club's Current Season", async () => {
      const { club, course, tee } = await fixture();
      const f = { club, course, tee };
      await create(f);
      await create(f, { startNextSeason: true });
      const [highest] = await db.select().from(schema.seasons).where(eq(schema.seasons.clubId, club.id)).orderBy(desc(schema.seasons.number)).limit(1);
      expect(highest.number).toBe(2);

      const tournament = await create(f);
      expect(tournament.seasonId).toBe(highest.id);
    });

    it("counts a Club's Tournaments through their Seasons", async () => {
      const { club, course, tee } = await fixture();
      const f = { club, course, tee };
      await create(f);
      await create(f, { startNextSeason: true });
      const clubRow = (await clubQueries.getAllClubsFull()).find((row) => row.id === club.id);
      expect(clubRow).toMatchObject({ tournamentsCount: 2 });
    });

    it("lists only non-empty Seasons and defaults standings to the newest non-empty Season", async () => {
      const { club, course, tee } = await fixture();
      const f = { club, course, tee };
      await create(f);
      const second = await create(f, { startNextSeason: true });
      await db.delete(schema.tournaments).where(eq(schema.tournaments.id, second.id));
      expect(await standings.getClubSeasons(club.id)).toEqual([{ season: 1 }]);
      expect((await standings.getLatestSeasonStandings({ clubHandle: club.handle }))?.season).toBe(1);
    });
  });

  describe("Pairing mutations", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.DATABASE_DRIVER = "node-postgres";
    const [{ db }, schema, actions, queries, cache] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("@/app/(app)/tournaments/actions"),
      import("./queries"),
      import("next/cache"),
    ]);
    const { eq, inArray } = await import("drizzle-orm");
    const clubIds: number[] = [];
    const courseIds: number[] = [];
    const userIds: string[] = [];

    async function tournamentFixture() {
      const suffix = crypto.randomUUID();
      const [club] = await db.insert(schema.clubs).values({
        handle: `club-${suffix}`,
        name: `Club ${suffix}`,
        pointRules: { participation: 0, pars: 0, birdies: 0, eagles: 0, aces: 0, strokes: { positions: [0] }, putts: { positions: [0] }, greenies: { tiers: [{ maxFt: null, pts: 0 }] } },
      }).returning();
      const [course] = await db.insert(schema.courses).values({ handle: `course-${suffix}`, name: `Course ${suffix}` }).returning();
      const [tee] = await db.insert(schema.courseTees).values({ courseId: course.id, name: "Blue", rating: "72", slope: 120 }).returning();
      const [season] = await db.insert(schema.seasons).values({ clubId: club.id, number: 1 }).returning();
      const [tournament] = await db.insert(schema.tournaments).values({
        seasonId: season.id,
        date: new Date("2026-01-01T00:00:00.000Z"),
        courseId: course.id,
        teeId: tee.id,
      }).returning();
      clubIds.push(club.id);
      courseIds.push(course.id);
      return { tournament, course, tee };
    }

    // A Tournament player: a user with a Round in that Tournament, which is
    // what a Pairing actually holds.
    async function playerFixture(
      f: Awaited<ReturnType<typeof tournamentFixture>>,
    ) {
      const suffix = crypto.randomUUID();
      const [user] = await db
        .insert(schema.users)
        .values({ email: `player-${suffix}@example.com`, firstName: "Player", lastName: suffix })
        .returning();
      const [round] = await db
        .insert(schema.rounds)
        .values({
          tournamentId: f.tournament.id,
          userId: user.id,
          courseId: f.course.id,
          teeId: f.tee.id,
          date: f.tournament.date,
        })
        .returning();
      userIds.push(user.id);
      return { user, round };
    }

    async function createPairing(tournamentId: number) {
      const result = await actions.createPairing({ tournamentId });
      if (!result.ok || result.id == null) throw new Error(result.ok ? "Missing Pairing id" : result.error);
      return result.id;
    }

    beforeEach(() => {
      getCurrentUser.mockResolvedValue({ isAdmin: true });
      vi.mocked(cache.revalidatePath).mockClear();
      vi.mocked(cache.updateTag).mockClear();
    });

    afterEach(async () => {
      // Rounds restrict their Tournament, Course and user, so they go first.
      if (userIds.length) await db.delete(schema.rounds).where(inArray(schema.rounds.userId, userIds));
      if (clubIds.length) {
        const clubSeasonIds = (await db.select({ id: schema.seasons.id }).from(schema.seasons).where(inArray(schema.seasons.clubId, clubIds))).map((season) => season.id);
        if (clubSeasonIds.length) await db.delete(schema.tournaments).where(inArray(schema.tournaments.seasonId, clubSeasonIds));
        await db.delete(schema.clubs).where(inArray(schema.clubs.id, clubIds));
      }
      if (courseIds.length) await db.delete(schema.courses).where(inArray(schema.courses.id, courseIds));
      if (userIds.length) await db.delete(schema.users).where(inArray(schema.users.id, userIds));
      clubIds.length = 0;
      courseIds.length = 0;
      userIds.length = 0;
    });

    it("rejects every Pairing mutation from a non-admin", async () => {
      const { tournament } = await tournamentFixture();
      const pairingId = await createPairing(tournament.id);
      getCurrentUser.mockResolvedValue({ isAdmin: false });

      expect(await actions.createPairing({ tournamentId: tournament.id })).toMatchObject({ ok: false });
      expect(await actions.renamePairing({ pairingId, name: "Late tee" })).toMatchObject({ ok: false });
      expect(await actions.deletePairing({ pairingId })).toMatchObject({ ok: false });
      expect(await actions.movePairing({ pairingId, direction: "up" })).toMatchObject({ ok: false });
      expect(await queries.getPairingsForTournament(tournament.id)).toMatchObject([{ id: pairingId, name: "Pairing 1" }]);
    });

    it("names each new Pairing by number without reusing a deleted number", async () => {
      const { tournament } = await tournamentFixture();
      const first = await createPairing(tournament.id);
      await createPairing(tournament.id);
      expect((await queries.getPairingsForTournament(tournament.id)).map(({ name }) => name)).toEqual(["Pairing 1", "Pairing 2"]);

      expect(await actions.deletePairing({ pairingId: first })).toMatchObject({ ok: true });
      await createPairing(tournament.id);
      expect((await queries.getPairingsForTournament(tournament.id)).map(({ name }) => name)).toEqual(["Pairing 2", "Pairing 3"]);
    });

    it("frees the last number again once its Pairing is deleted", async () => {
      const { tournament } = await tournamentFixture();
      await createPairing(tournament.id);
      const second = await createPairing(tournament.id);

      expect(await actions.deletePairing({ pairingId: second })).toMatchObject({ ok: true });
      await createPairing(tournament.id);
      expect((await queries.getPairingsForTournament(tournament.id)).map(({ name }) => name)).toEqual(["Pairing 1", "Pairing 2"]);
    });

    it("moves a Pairing up and down its Tournament's order", async () => {
      const { tournament } = await tournamentFixture();
      const first = await createPairing(tournament.id);
      const second = await createPairing(tournament.id);
      const third = await createPairing(tournament.id);
      const order = async () => (await queries.getPairingsForTournament(tournament.id)).map(({ id }) => id);

      expect(await actions.movePairing({ pairingId: third, direction: "up" })).toMatchObject({ ok: true });
      expect(await order()).toEqual([first, third, second]);

      expect(await actions.movePairing({ pairingId: third, direction: "down" })).toMatchObject({ ok: true });
      expect(await order()).toEqual([first, second, third]);

      expect(await actions.movePairing({ pairingId: first, direction: "up" })).toMatchObject({ ok: false });
      expect(await actions.movePairing({ pairingId: third, direction: "down" })).toMatchObject({ ok: false });
      expect(await order()).toEqual([first, second, third]);
    });

    it("keeps numbering ahead of a reordered Tournament's Pairings", async () => {
      const { tournament } = await tournamentFixture();
      await createPairing(tournament.id);
      const second = await createPairing(tournament.id);
      await actions.movePairing({ pairingId: second, direction: "up" });

      await createPairing(tournament.id);
      expect((await queries.getPairingsForTournament(tournament.id)).map(({ name }) => name)).toEqual(["Pairing 2", "Pairing 1", "Pairing 3"]);
    });

    it("numbers Pairings per Tournament", async () => {
      const { tournament: first } = await tournamentFixture();
      const { tournament: second } = await tournamentFixture();
      await createPairing(first.id);
      await createPairing(second.id);
      expect((await queries.getPairingsForTournament(second.id)).map(({ name }) => name)).toEqual(["Pairing 1"]);
    });

    it("renames a Pairing", async () => {
      const { tournament } = await tournamentFixture();
      const pairingId = await createPairing(tournament.id);

      expect(await actions.renamePairing({ pairingId, name: "  8:30 tee  " })).toMatchObject({ ok: true });
      expect(await queries.getPairingsForTournament(tournament.id)).toMatchObject([{ id: pairingId, name: "8:30 tee" }]);
      expect(await actions.renamePairing({ pairingId, name: "   " })).toMatchObject({ ok: false });
    });

    it("deletes a Pairing and leaves the Tournament's other Pairings ordered", async () => {
      const { tournament } = await tournamentFixture();
      const first = await createPairing(tournament.id);
      const second = await createPairing(tournament.id);

      expect(await actions.deletePairing({ pairingId: first })).toMatchObject({ ok: true });
      expect(await queries.getPairingsForTournament(tournament.id)).toMatchObject([{ id: second, name: "Pairing 2" }]);
      const [stillThere] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, tournament.id));
      expect(stillThere).toBeDefined();
    });

    it("assigns an unassigned Round to a Pairing", async () => {
      const f = await tournamentFixture();
      const pairingId = await createPairing(f.tournament.id);
      const { user, round } = await playerFixture(f);
      expect(await queries.getUnassignedRoundsForTournament(f.tournament.id)).toMatchObject([{ roundId: round.id, userId: user.id }]);

      expect(await actions.assignRoundToPairing({ pairingId, roundId: round.id })).toMatchObject({ ok: true });
      expect(await queries.getPairingsForTournament(f.tournament.id)).toMatchObject([{ id: pairingId, members: [{ roundId: round.id, userId: user.id }] }]);
      expect(await queries.getUnassignedRoundsForTournament(f.tournament.id)).toEqual([]);
    });

    it("moves a Round from one Pairing to another", async () => {
      const f = await tournamentFixture();
      const first = await createPairing(f.tournament.id);
      const second = await createPairing(f.tournament.id);
      const { round } = await playerFixture(f);
      await actions.assignRoundToPairing({ pairingId: first, roundId: round.id });

      expect(await actions.assignRoundToPairing({ pairingId: second, roundId: round.id })).toMatchObject({ ok: true });
      expect(await queries.getPairingsForTournament(f.tournament.id)).toMatchObject([
        { id: first, members: [] },
        { id: second, members: [{ roundId: round.id }] },
      ]);
    });

    it("removes a Round from its Pairing without removing the player from the Tournament", async () => {
      const f = await tournamentFixture();
      const pairingId = await createPairing(f.tournament.id);
      const { round } = await playerFixture(f);
      await actions.assignRoundToPairing({ pairingId, roundId: round.id });

      expect(await actions.removeRoundFromPairing({ roundId: round.id })).toMatchObject({ ok: true });
      expect(await queries.getPairingsForTournament(f.tournament.id)).toMatchObject([{ id: pairingId, members: [] }]);
      expect(await queries.getUnassignedRoundsForTournament(f.tournament.id)).toMatchObject([{ roundId: round.id }]);
      const [stillPlaying] = await db.select().from(schema.rounds).where(eq(schema.rounds.id, round.id));
      expect(stillPlaying).toMatchObject({ tournamentId: f.tournament.id });
    });

    it("leaves a player added after grouping unassigned", async () => {
      const f = await tournamentFixture();
      const pairingId = await createPairing(f.tournament.id);
      const early = await playerFixture(f);
      await actions.assignRoundToPairing({ pairingId, roundId: early.round.id });

      const late = await playerFixture(f);
      expect(await queries.getUnassignedRoundsForTournament(f.tournament.id)).toMatchObject([{ roundId: late.round.id }]);
      expect(await queries.getPairingsForTournament(f.tournament.id)).toMatchObject([{ members: [{ roundId: early.round.id }] }]);
    });

    it("rejects a fifth Round with a message", async () => {
      const f = await tournamentFixture();
      const pairingId = await createPairing(f.tournament.id);
      const rounds = [];
      for (let i = 0; i < 5; i += 1) rounds.push((await playerFixture(f)).round);
      for (const round of rounds.slice(0, 4)) {
        expect(await actions.assignRoundToPairing({ pairingId, roundId: round.id })).toMatchObject({ ok: true });
      }

      const fifth = await actions.assignRoundToPairing({ pairingId, roundId: rounds[4].id });
      expect(fifth).toMatchObject({ ok: false, error: expect.stringContaining("4") });
      expect(await queries.getUnassignedRoundsForTournament(f.tournament.id)).toMatchObject([{ roundId: rounds[4].id }]);
    });

    it("rejects a Round from another Tournament", async () => {
      const f = await tournamentFixture();
      const other = await tournamentFixture();
      const pairingId = await createPairing(f.tournament.id);
      const { round } = await playerFixture(other);

      expect(await actions.assignRoundToPairing({ pairingId, roundId: round.id })).toMatchObject({ ok: false });
      expect(await queries.getPairingsForTournament(f.tournament.id)).toMatchObject([{ members: [] }]);
    });

    it("rejects membership changes from a non-admin", async () => {
      const f = await tournamentFixture();
      const pairingId = await createPairing(f.tournament.id);
      const assigned = await playerFixture(f);
      const unassigned = await playerFixture(f);
      await actions.assignRoundToPairing({ pairingId, roundId: assigned.round.id });
      getCurrentUser.mockResolvedValue({ isAdmin: false });

      expect(await actions.assignRoundToPairing({ pairingId, roundId: unassigned.round.id })).toMatchObject({ ok: false });
      expect(await actions.removeRoundFromPairing({ roundId: assigned.round.id })).toMatchObject({ ok: false });
      expect(await queries.getPairingsForTournament(f.tournament.id)).toMatchObject([{ members: [{ roundId: assigned.round.id }] }]);
    });

    it("reassigns a player whose scores already exist and leaves those scores untouched", async () => {
      const f = await tournamentFixture();
      const first = await createPairing(f.tournament.id);
      const second = await createPairing(f.tournament.id);
      const { round } = await playerFixture(f);
      await actions.assignRoundToPairing({ pairingId: first, roundId: round.id });
      await db.insert(schema.roundScores).values({ roundId: round.id, hole: 1, strokes: 4, putts: 2 });

      expect(await actions.assignRoundToPairing({ pairingId: second, roundId: round.id })).toMatchObject({ ok: true });
      expect(await db.select().from(schema.roundScores).where(eq(schema.roundScores.roundId, round.id))).toMatchObject([{ hole: 1, strokes: 4, putts: 2 }]);
    });

    it("returns a deleted Pairing's members to unassigned without removing their Rounds", async () => {
      const f = await tournamentFixture();
      const pairingId = await createPairing(f.tournament.id);
      const { round } = await playerFixture(f);
      await actions.assignRoundToPairing({ pairingId, roundId: round.id });

      expect(await actions.deletePairing({ pairingId })).toMatchObject({ ok: true });
      expect(await queries.getPairingsForTournament(f.tournament.id)).toEqual([]);
      expect(await queries.getUnassignedRoundsForTournament(f.tournament.id)).toMatchObject([{ roundId: round.id }]);
    });

    it("revalidates the Tournament page without touching the home events cache", async () => {
      const { tournament } = await tournamentFixture();
      const pairingId = await createPairing(tournament.id);
      expect(vi.mocked(cache.revalidatePath)).toHaveBeenCalledWith(`/tournaments/${tournament.id}`);
      expect(vi.mocked(cache.updateTag)).not.toHaveBeenCalled();

      await actions.renamePairing({ pairingId, name: "Flight A" });
      await actions.movePairing({ pairingId, direction: "up" });
      await actions.deletePairing({ pairingId });
      expect(vi.mocked(cache.updateTag)).not.toHaveBeenCalled();
    });
  });
}
