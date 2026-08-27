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
      return { tournament };
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
      if (clubIds.length) {
        const clubSeasonIds = (await db.select({ id: schema.seasons.id }).from(schema.seasons).where(inArray(schema.seasons.clubId, clubIds))).map((season) => season.id);
        if (clubSeasonIds.length) await db.delete(schema.tournaments).where(inArray(schema.tournaments.seasonId, clubSeasonIds));
        await db.delete(schema.clubs).where(inArray(schema.clubs.id, clubIds));
      }
      if (courseIds.length) await db.delete(schema.courses).where(inArray(schema.courses.id, courseIds));
      clubIds.length = 0;
      courseIds.length = 0;
    });

    it("rejects every Pairing mutation from a non-admin", async () => {
      const { tournament } = await tournamentFixture();
      const pairingId = await createPairing(tournament.id);
      getCurrentUser.mockResolvedValue({ isAdmin: false });

      expect(await actions.createPairing({ tournamentId: tournament.id })).toMatchObject({ ok: false });
      expect(await actions.renamePairing({ pairingId, name: "Late tee" })).toMatchObject({ ok: false });
      expect(await actions.deletePairing({ pairingId })).toMatchObject({ ok: false });
      expect(await queries.getPairingsForTournament(tournament.id)).toHaveLength(1);
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

    it("revalidates the Tournament page without touching the home events cache", async () => {
      const { tournament } = await tournamentFixture();
      const pairingId = await createPairing(tournament.id);
      expect(vi.mocked(cache.revalidatePath)).toHaveBeenCalledWith(`/tournaments/${tournament.id}`);
      expect(vi.mocked(cache.updateTag)).not.toHaveBeenCalled();

      await actions.renamePairing({ pairingId, name: "Flight A" });
      await actions.deletePairing({ pairingId });
      expect(vi.mocked(cache.updateTag)).not.toHaveBeenCalled();
    });
  });
}
