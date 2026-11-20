import { revalidatePath, updateTag } from "next/cache";
import { beforeEach, describe, expect, it } from "vitest";

import { required } from "@/lib/required";
import * as clubs from "@/modules/clubs/server";
import {
  changeRoundSettings,
  getTournamentRounds,
} from "@/modules/rounds/server";
import * as seasons from "@/modules/seasons/server";
import * as tournaments from "@/modules/tournaments/server";
import { clearCacheMocks } from "@/test/cache-mocks";
import { createFixtures } from "@/test/fixtures";
import { invalidatedPaths, roundChangedPaths } from "@/test/round-changed";

describe("Tournament Season mutations", () => {
  const fixtures = createFixtures();
  let admin: Awaited<ReturnType<typeof fixtures.player>>;

  async function fixture() {
    const club = await fixtures.club();
    const { course, tee } = await fixtures.course();
    return { club, course, tee };
  }

  async function stored(id: number) {
    return required(await tournaments.getTournamentById(id), "tournament");
  }

  async function create(
    f: Awaited<ReturnType<typeof fixture>>,
    input: { seasonId?: number; startNextSeason?: boolean; date?: string } = {},
  ) {
    const result = await tournaments.createTournament(admin.id, {
      clubHandle: f.club.handle,
      seasonId: input.seasonId ?? null,
      startNextSeason: input.startNextSeason ?? false,
      date: input.date ?? "2026-01-01",
      courseHandle: f.course.handle,
      teeId: f.tee.id,
    });
    if (!result.ok || result.id == null)
      throw new Error(result.ok ? "Missing Tournament id" : result.error);
    return stored(result.id);
  }

  async function tournamentRounds(id: number) {
    return (await getTournamentRounds(id)).rounds;
  }

  beforeEach(async () => {
    admin = await fixtures.player({ isAdmin: true });
  });

  it("creates Season 1 for a Club's first Tournament", async () => {
    const { club, course, tee } = await fixture();
    const f = { club, course, tee };
    const tournament = await create(f);
    expect(await seasons.getClubSeasonNumbers(club.id)).toEqual([1]);
    expect(tournament).toMatchObject({ clubId: club.id, season: 1 });
    expect(await tournaments.getAllTournaments()).toContainEqual(
      expect.objectContaining({
        id: tournament.id,
        clubId: club.id,
        season: 1,
      }),
    );
  });

  it("atomically starts the next Season with its Tournament", async () => {
    const { club, course, tee } = await fixture();
    const f = { club, course, tee };
    await create(f);
    const tournament = await create(f, {
      startNextSeason: true,
      date: "2025-01-01",
    });
    expect(await seasons.getClubSeasonNumbers(club.id)).toEqual([1, 2]);
    expect(tournament.season).toBe(2);
  });

  it("reassigns a Tournament through its Season regardless of date", async () => {
    const { club, course, tee } = await fixture();
    const f = { club, course, tee };
    const first = await create(f, { date: "2030-01-01" });
    const second = await create(f, {
      startNextSeason: true,
      date: "2020-01-01",
    });
    const seasonOne = { id: first.seasonId };
    const update = await tournaments.updateTournament(admin.id, {
      id: second.id,
      clubHandle: club.handle,
      seasonId: seasonOne.id,
      date: "2010-01-01",
      courseHandle: course.handle,
      teeId: tee.id,
    });
    expect(update.ok).toBe(true);
    expect(await stored(second.id)).toMatchObject({
      seasonId: seasonOne.id,
      clubId: club.id,
      season: 1,
    });
  });

  it("defaults a new Tournament to the Club's Current Season", async () => {
    const { club, course, tee } = await fixture();
    const f = { club, course, tee };
    await create(f);
    const highest = await create(f, { startNextSeason: true });
    expect(highest.season).toBe(2);

    const tournament = await create(f);
    expect(tournament.seasonId).toBe(highest.seasonId);
  });

  it("counts a Club's Tournaments through their Seasons", async () => {
    const { club, course, tee } = await fixture();
    const f = { club, course, tee };
    await create(f);
    await create(f, { startNextSeason: true });
    const clubRow = (await clubs.getAllClubsFull()).find(
      (row) => row.id === club.id,
    );
    expect(clubRow).toMatchObject({ tournamentsCount: 2 });
  });

  it("lists only non-empty Seasons and defaults standings to the newest non-empty Season", async () => {
    const { club, course, tee } = await fixture();
    const f = { club, course, tee };
    await create(f);
    const second = await create(f, { startNextSeason: true });
    expect(await tournaments.deleteTournament(admin.id, second.id)).toEqual({
      ok: true,
    });
    expect(await seasons.getClubSeasons(club.id)).toEqual([{ season: 1 }]);
    expect(
      (await seasons.getSeasonStandings({ clubId: club.id, season: 1 }))
        ?.tournaments,
    ).toHaveLength(1);
  });

  it("refuses a Season from another Club", async () => {
    const f = await fixture();
    const other = await fixture();
    const otherTournament = await create(other);

    expect(
      await tournaments.createTournament(admin.id, {
        clubHandle: f.club.handle,
        seasonId: otherTournament.seasonId,
        startNextSeason: false,
        date: "2026-01-01",
        courseHandle: f.course.handle,
        teeId: f.tee.id,
      }),
    ).toEqual({
      ok: false,
      error: "Selected Season does not belong to this Club.",
    });
  });

  it("refreshes the Tournament pages and home events on create and update", async () => {
    const f = await fixture();
    const tournament = await create(f);
    expect(updateTag).toHaveBeenCalledWith("home-events");
    expect(invalidatedPaths(revalidatePath)).toEqual(
      [
        "/",
        "/clubs/[handle] page",
        "/tournaments",
        `/tournaments/${tournament.id}`,
        `/tournaments/${tournament.id}/edit`,
      ].sort(),
    );

    clearCacheMocks();
    expect(
      await tournaments.updateTournament(admin.id, {
        id: tournament.id,
        clubHandle: f.club.handle,
        seasonId: tournament.seasonId,
        date: "2026-02-02",
        courseHandle: f.course.handle,
        teeId: f.tee.id,
      }),
    ).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith("home-events");
    expect(invalidatedPaths(revalidatePath)).toEqual(
      [
        "/",
        "/clubs/[handle] page",
        "/tournaments",
        `/tournaments/${tournament.id}`,
        `/tournaments/${tournament.id}/edit`,
      ].sort(),
    );
  });

  it("refuses every Tournament write from a non-admin", async () => {
    const f = await fixture();
    const tournament = await create(f);
    const player = await fixtures.player();
    const notAdmin = {
      ok: false,
      error: "Only admins can manage Tournaments.",
    };
    clearCacheMocks();

    expect(
      await tournaments.createTournament(player.id, {
        clubHandle: f.club.handle,
        seasonId: null,
        startNextSeason: false,
        date: "2026-01-01",
        courseHandle: f.course.handle,
        teeId: f.tee.id,
      }),
    ).toEqual(notAdmin);
    expect(
      await tournaments.updateTournament(player.id, {
        id: tournament.id,
        clubHandle: f.club.handle,
        seasonId: tournament.seasonId,
        date: "2020-01-01",
        courseHandle: f.course.handle,
        teeId: f.tee.id,
      }),
    ).toEqual(notAdmin);
    expect(
      await tournaments.deleteTournament(player.id, tournament.id),
    ).toEqual(notAdmin);
    expect(
      await tournaments.addPlayersToTournament(player.id, {
        tournamentId: tournament.id,
        playerIds: [player.id],
      }),
    ).toEqual({ ok: false, error: "Only admins can add players." });

    expect(await stored(tournament.id)).toEqual(tournament);
    expect(await tournamentRounds(tournament.id)).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  describe("update syncs the Tournament's Rounds", () => {
    type TournamentFixture = Awaited<ReturnType<typeof fixtures.tournament>>;

    async function update(
      t: TournamentFixture,
      next: { courseHandle?: string; teeId?: number; date?: string },
    ) {
      clearCacheMocks();
      return tournaments.updateTournament(admin.id, {
        id: t.tournament.id,
        clubHandle: t.club.handle,
        seasonId: required(t.tournament.seasonId, "season"),
        date: next.date ?? "2026-01-01",
        courseHandle: next.courseHandle ?? t.course.handle,
        teeId: next.teeId ?? t.tee.id,
      });
    }

    const tournamentChanged = (id: number) => [
      "/",
      "/clubs/[handle] page",
      "/tournaments",
      `/tournaments/${id}`,
      `/tournaments/${id}/edit`,
    ];

    it("moves unscored Rounds to the new course and tee, refreshing their pages", async () => {
      const t = await fixtures.tournament();
      const a = await fixtures.tournamentPlayer(t);
      const b = await fixtures.tournamentPlayer(t);
      const next = await fixtures.course();

      expect(
        await update(t, {
          courseHandle: next.course.handle,
          teeId: next.tee.id,
        }),
      ).toEqual({ ok: true });

      for (const round of await tournamentRounds(t.tournament.id)) {
        expect(round).toMatchObject({
          courseId: next.course.id,
          teeId: next.tee.id,
        });
      }
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths(revalidatePath)).toEqual(
        [
          ...tournamentChanged(t.tournament.id),
          ...roundChangedPaths(a.round, b.round),
        ].sort(),
      );
    });

    it("refuses a course change while a Round has scores, naming the player and changing nothing", async () => {
      const t = await fixtures.tournament();
      const scored = await fixtures.tournamentPlayer(t);
      await fixtures.tournamentPlayer(t);
      await fixtures.scores(scored.round.id, [{ hole: 1, strokes: 5 }]);
      const next = await fixtures.course();

      expect(
        await update(t, {
          courseHandle: next.course.handle,
          teeId: next.tee.id,
          date: "2026-04-04",
        }),
      ).toEqual({
        ok: false,
        error: `Can't change the course: Player ${scored.player.lastName} already has scores or Greenies.`,
      });

      expect(await stored(t.tournament.id)).toMatchObject(t.tournament);
      for (const round of await tournamentRounds(t.tournament.id)) {
        expect(round).toMatchObject({
          courseId: t.course.id,
          teeId: t.tee.id,
          date: t.tournament.date,
        });
      }
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("carries a date change to scored Rounds", async () => {
      const t = await fixtures.tournament();
      const scored = await fixtures.tournamentPlayer(t);
      await fixtures.scores(scored.round.id, [{ hole: 1, strokes: 5 }]);

      expect(await update(t, { date: "2026-04-04" })).toEqual({ ok: true });

      const [round] = await tournamentRounds(t.tournament.id);
      expect(round.date).toEqual(new Date("2026-04-04T00:00:00.000Z"));
      expect(invalidatedPaths(revalidatePath)).toContain(
        `/rounds/${scored.round.id}`,
      );
    });

    it("moves Rounds on the old Tournament tee on a tee-only change, leaving player-chosen tees", async () => {
      const t = await fixtures.tournament();
      const onEventTee = await fixtures.tournamentPlayer(t);
      const chosen = await fixtures.tournamentPlayer(t);
      const red = await fixtures.tee(t.course.handle, "Red");
      expect(
        await changeRoundSettings(chosen.player.id, chosen.round.id, {
          teeId: red.id,
        }),
      ).toEqual({ ok: true });
      const white = await fixtures.tee(t.course.handle);

      expect(await update(t, { teeId: white.id })).toEqual({ ok: true });

      const byId = new Map(
        (await tournamentRounds(t.tournament.id)).map((round) => [
          round.id,
          round,
        ]),
      );
      expect(byId.get(onEventTee.round.id)?.teeId).toBe(white.id);
      expect(byId.get(chosen.round.id)?.teeId).toBe(red.id);
      expect(invalidatedPaths(revalidatePath)).toEqual(
        [
          ...tournamentChanged(t.tournament.id),
          ...roundChangedPaths(onEventTee.round),
        ].sort(),
      );
    });
  });

  describe("add players", () => {
    it("gives each player a Round on the Tournament's course, tee and date", async () => {
      const t = await fixtures.tournament();
      const a = await fixtures.player();
      const b = await fixtures.player();

      expect(
        await tournaments.addPlayersToTournament(admin.id, {
          tournamentId: t.tournament.id,
          playerIds: [a.id, b.id],
        }),
      ).toEqual({ ok: true, added: 2 });

      const added = await tournamentRounds(t.tournament.id);
      expect(added.map((round) => round.playerId).sort()).toEqual(
        [a.id, b.id].sort(),
      );
      for (const round of added) {
        expect(round).toMatchObject({
          courseId: t.course.id,
          teeId: t.tee.id,
          date: t.tournament.date,
        });
      }
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths(revalidatePath)).toEqual(
        [
          ...roundChangedPaths(...added),
          `/tournaments/${t.tournament.id}`,
          `/tournaments/${t.tournament.id}/edit`,
        ].sort(),
      );
    });

    it("counts only players who were not already in the Tournament", async () => {
      const t = await fixtures.tournament();
      const existing = await fixtures.tournamentPlayer(t);
      const newcomer = await fixtures.player();

      expect(
        await tournaments.addPlayersToTournament(admin.id, {
          tournamentId: t.tournament.id,
          playerIds: [existing.player.id, newcomer.id],
        }),
      ).toEqual({ ok: true, added: 1 });
    });

    it("refuses a player who no longer exists and adds no one", async () => {
      const t = await fixtures.tournament();
      const a = await fixtures.player();

      expect(
        await tournaments.addPlayersToTournament(admin.id, {
          tournamentId: t.tournament.id,
          playerIds: [a.id, crypto.randomUUID()],
        }),
      ).toEqual({
        ok: false,
        error: "One or more selected players no longer exist.",
      });
      expect(await tournamentRounds(t.tournament.id)).toEqual([]);
    });
  });

  describe("delete", () => {
    it("refuses while the Tournament has Rounds", async () => {
      const t = await fixtures.tournament();
      await fixtures.tournamentPlayer(t);

      expect(
        await tournaments.deleteTournament(admin.id, t.tournament.id),
      ).toEqual({
        ok: false,
        error: "Cannot delete: tournament has 1 round(s).",
      });
      expect(
        await tournaments.getTournamentById(t.tournament.id),
      ).toBeDefined();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("deletes a Tournament without Rounds", async () => {
      const t = await fixtures.tournament();

      expect(
        await tournaments.deleteTournament(admin.id, t.tournament.id),
      ).toEqual({ ok: true });
      expect(
        await tournaments.getTournamentById(t.tournament.id),
      ).toBeUndefined();
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths(revalidatePath)).toEqual(
        [
          "/",
          "/clubs/[handle] page",
          "/tournaments",
          `/tournaments/${t.tournament.id}`,
          `/tournaments/${t.tournament.id}/edit`,
        ].sort(),
      );
    });
  });
});
