import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath, updateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath, updateTag }));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe.skip("Tournament Season mutations", () => {
    it("requires TEST_DATABASE_URL", () => {});
  });
} else {
  describe("Tournament Season mutations", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.DATABASE_DRIVER = "node-postgres";
    const [{ db }, schema, mutations, standings, queries, clubQueries, { createRoundFixtures }] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("./mutations"),
      import("@/lib/clubs/standings/queries"),
      import("./queries"),
      import("@/lib/clubs/queries"),
      import("@/lib/rounds/test-fixtures"),
    ]);
    const { desc, eq } = await import("drizzle-orm");
    const clubIds: number[] = [];
    const courseIds: number[] = [];
    const fixtures = createRoundFixtures(db, schema);
    let admin: Awaited<ReturnType<typeof fixtures.user>>;

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
      const result = await mutations.createTournament(admin.id, {
        clubHandle: f.club.handle,
        seasonId: input.seasonId ?? null,
        startNextSeason: input.startNextSeason ?? false,
        date: input.date ?? "2026-01-01",
        courseHandle: f.course.handle,
        teeId: f.tee.id,
      });
      if (!result.ok || result.id == null) throw new Error(result.ok ? "Missing Tournament id" : result.error);
      const [tournament] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, result.id));
      return tournament;
    }

    function invalidatedPaths() {
      const calls = revalidatePath.mock.calls as unknown as string[][];
      return [...new Set(calls.map((call) => call.join(" ")))].sort();
    }

    beforeEach(async () => {
      admin = await fixtures.user({ isAdmin: true });
      revalidatePath.mockClear();
      updateTag.mockClear();
    });

    afterEach(async () => {
      await fixtures.cleanup();
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
      const update = await mutations.updateTournament(admin.id, { id: second.id, clubHandle: club.handle, seasonId: seasonOne.id, date: "2010-01-01", courseHandle: course.handle, teeId: tee.id });
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

    it("refuses a Season from another Club", async () => {
      const f = await fixture();
      const other = await fixture();
      const otherTournament = await create(other);

      expect(await mutations.createTournament(admin.id, {
        clubHandle: f.club.handle,
        seasonId: otherTournament.seasonId,
        startNextSeason: false,
        date: "2026-01-01",
        courseHandle: f.course.handle,
        teeId: f.tee.id,
      })).toEqual({ ok: false, error: "Selected Season does not belong to this Club." });
    });

    it("refreshes the Tournament pages and home events on create and update", async () => {
      const f = await fixture();
      const tournament = await create(f);
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths()).toEqual(["/", "/clubs/[handle] page", "/tournaments", `/tournaments/${tournament.id}`, `/tournaments/${tournament.id}/edit`].sort());

      revalidatePath.mockClear();
      updateTag.mockClear();
      expect(await mutations.updateTournament(admin.id, { id: tournament.id, clubHandle: f.club.handle, seasonId: tournament.seasonId, date: "2026-02-02", courseHandle: f.course.handle, teeId: f.tee.id })).toEqual({ ok: true });
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths()).toEqual(["/", "/clubs/[handle] page", "/tournaments", `/tournaments/${tournament.id}`, `/tournaments/${tournament.id}/edit`].sort());
    });

    it("refuses every Tournament write from a non-admin", async () => {
      const f = await fixture();
      const tournament = await create(f);
      const player = await fixtures.user();
      const notAdmin = { ok: false, error: "Only admins can manage Tournaments." };
      revalidatePath.mockClear();

      expect(await mutations.createTournament(player.id, { clubHandle: f.club.handle, seasonId: null, startNextSeason: false, date: "2026-01-01", courseHandle: f.course.handle, teeId: f.tee.id })).toEqual(notAdmin);
      expect(await mutations.updateTournament(player.id, { id: tournament.id, clubHandle: f.club.handle, seasonId: tournament.seasonId, date: "2020-01-01", courseHandle: f.course.handle, teeId: f.tee.id })).toEqual(notAdmin);
      expect(await mutations.deleteTournament(player.id, tournament.id)).toEqual(notAdmin);
      expect(await mutations.addPlayersToTournament(player.id, { tournamentId: tournament.id, userIds: [player.id] })).toEqual({ ok: false, error: "Only admins can add players." });

      const [unchanged] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, tournament.id));
      expect(unchanged).toEqual(tournament);
      expect(await db.select().from(schema.rounds).where(eq(schema.rounds.tournamentId, tournament.id))).toEqual([]);
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    describe("update syncs the Tournament's Rounds", () => {
      type TournamentFixture = Awaited<ReturnType<typeof fixtures.tournament>>;

      async function update(t: TournamentFixture, next: { courseHandle?: string; teeId?: number; date?: string }) {
        const [club] = await db.select({ handle: schema.clubs.handle }).from(schema.clubs).innerJoin(schema.seasons, eq(schema.seasons.clubId, schema.clubs.id)).where(eq(schema.seasons.id, t.tournament.seasonId));
        return mutations.updateTournament(admin.id, {
          id: t.tournament.id,
          clubHandle: club.handle,
          seasonId: t.tournament.seasonId,
          date: next.date ?? "2026-01-01",
          courseHandle: next.courseHandle ?? t.course.handle,
          teeId: next.teeId ?? t.tee.id,
        });
      }

      async function tournamentRounds(id: number) {
        return db.select().from(schema.rounds).where(eq(schema.rounds.tournamentId, id));
      }

      const tournamentChanged = (id: number) => ["/", "/clubs/[handle] page", "/tournaments", `/tournaments/${id}`, `/tournaments/${id}/edit`];

      it("moves unscored Rounds to the new course and tee, refreshing their pages", async () => {
        const t = await fixtures.tournament();
        const a = await fixtures.tournamentPlayer(t);
        const b = await fixtures.tournamentPlayer(t);
        const next = await fixtures.course();

        expect(await update(t, { courseHandle: next.course.handle, teeId: next.tee.id })).toEqual({ ok: true });

        for (const round of await tournamentRounds(t.tournament.id)) {
          expect(round).toMatchObject({ courseId: next.course.id, teeId: next.tee.id });
        }
        expect(updateTag).toHaveBeenCalledWith("home-events");
        expect(invalidatedPaths()).toEqual([
          ...tournamentChanged(t.tournament.id), "/records",
          ...[a, b].flatMap((p) => [`/players/${p.user.id}`, `/rounds/${p.round.id}`]),
        ].sort());
      });

      it("refuses a course change while a Round has scores, naming the player and changing nothing", async () => {
        const t = await fixtures.tournament();
        const scored = await fixtures.tournamentPlayer(t);
        await fixtures.tournamentPlayer(t);
        await db.insert(schema.roundScores).values({ roundId: scored.round.id, hole: 1, strokes: 5 });
        const next = await fixtures.course();

        expect(await update(t, { courseHandle: next.course.handle, teeId: next.tee.id, date: "2026-04-04" })).toEqual({
          ok: false,
          error: `Can't change the course: Player ${scored.user.lastName} already has scores or Greenies.`,
        });

        const [tournament] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, t.tournament.id));
        expect(tournament).toEqual(t.tournament);
        for (const round of await tournamentRounds(t.tournament.id)) {
          expect(round).toMatchObject({ courseId: t.course.id, teeId: t.tee.id, date: t.tournament.date });
        }
        expect(revalidatePath).not.toHaveBeenCalled();
      });

      it("carries a date change to scored Rounds", async () => {
        const t = await fixtures.tournament();
        const scored = await fixtures.tournamentPlayer(t);
        await db.insert(schema.roundScores).values({ roundId: scored.round.id, hole: 1, strokes: 5 });

        expect(await update(t, { date: "2026-04-04" })).toEqual({ ok: true });

        const [round] = await tournamentRounds(t.tournament.id);
        expect(round.date).toEqual(new Date("2026-04-04T00:00:00.000Z"));
        expect(invalidatedPaths()).toContain(`/rounds/${scored.round.id}`);
      });

      it("moves Rounds on the old Tournament tee on a tee-only change, leaving player-chosen tees", async () => {
        const t = await fixtures.tournament();
        const onEventTee = await fixtures.tournamentPlayer(t);
        const chosen = await fixtures.tournamentPlayer(t);
        const red = await fixtures.tee(t.course.id, "Red");
        await db.update(schema.rounds).set({ teeId: red.id }).where(eq(schema.rounds.id, chosen.round.id));
        const white = await fixtures.tee(t.course.id);

        expect(await update(t, { teeId: white.id })).toEqual({ ok: true });

        const byId = new Map((await tournamentRounds(t.tournament.id)).map((round) => [round.id, round]));
        expect(byId.get(onEventTee.round.id)?.teeId).toBe(white.id);
        expect(byId.get(chosen.round.id)?.teeId).toBe(red.id);
        expect(invalidatedPaths()).toEqual([
          ...tournamentChanged(t.tournament.id), "/records",
          `/players/${onEventTee.user.id}`, `/rounds/${onEventTee.round.id}`,
        ].sort());
      });
    });

    describe("add players", () => {
      it("gives each player a Round on the Tournament's course, tee and date", async () => {
        const t = await fixtures.tournament();
        const a = await fixtures.user();
        const b = await fixtures.user();

        expect(await mutations.addPlayersToTournament(admin.id, { tournamentId: t.tournament.id, userIds: [a.id, b.id] })).toEqual({ ok: true, added: 2 });

        const added = await db.select().from(schema.rounds).where(eq(schema.rounds.tournamentId, t.tournament.id));
        expect(added.map((round) => round.userId).sort()).toEqual([a.id, b.id].sort());
        for (const round of added) {
          expect(round).toMatchObject({ courseId: t.course.id, teeId: t.tee.id, date: t.tournament.date });
        }
        expect(updateTag).toHaveBeenCalledWith("home-events");
        expect(invalidatedPaths()).toEqual([
          "/", "/records", "/clubs/[handle] page",
          `/tournaments/${t.tournament.id}`, `/tournaments/${t.tournament.id}/edit`,
          ...added.flatMap((round) => [`/players/${round.userId}`, `/rounds/${round.id}`]),
        ].sort());
      });

      it("counts only players who were not already in the Tournament", async () => {
        const t = await fixtures.tournament();
        const existing = await fixtures.tournamentPlayer(t);
        const newcomer = await fixtures.user();

        expect(await mutations.addPlayersToTournament(admin.id, { tournamentId: t.tournament.id, userIds: [existing.user.id, newcomer.id] })).toEqual({ ok: true, added: 1 });
      });

      it("refuses a player who no longer exists and adds no one", async () => {
        const t = await fixtures.tournament();
        const a = await fixtures.user();

        expect(await mutations.addPlayersToTournament(admin.id, { tournamentId: t.tournament.id, userIds: [a.id, crypto.randomUUID()] })).toEqual({ ok: false, error: "One or more selected players no longer exist." });
        expect(await db.select().from(schema.rounds).where(eq(schema.rounds.tournamentId, t.tournament.id))).toEqual([]);
      });
    });

    describe("delete", () => {
      it("refuses while the Tournament has Rounds", async () => {
        const t = await fixtures.tournament();
        await fixtures.tournamentPlayer(t);

        expect(await mutations.deleteTournament(admin.id, t.tournament.id)).toEqual({ ok: false, error: "Cannot delete: tournament has 1 round(s)." });
        expect(await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, t.tournament.id))).toHaveLength(1);
        expect(revalidatePath).not.toHaveBeenCalled();
      });

      it("deletes a Tournament without Rounds", async () => {
        const t = await fixtures.tournament();

        expect(await mutations.deleteTournament(admin.id, t.tournament.id)).toEqual({ ok: true });
        expect(await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, t.tournament.id))).toEqual([]);
        expect(updateTag).toHaveBeenCalledWith("home-events");
        expect(invalidatedPaths()).toEqual(["/", "/clubs/[handle] page", "/tournaments", `/tournaments/${t.tournament.id}`, `/tournaments/${t.tournament.id}/edit`].sort());
      });
    });
  });
}
