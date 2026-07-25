import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/users/queries", () => ({ getCurrentUser: async () => ({ isAdmin: true }) }));

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

    it("defaults a new Tournament to the Club's highest-numbered Season", async () => {
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
}
