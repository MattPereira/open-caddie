import { revalidatePath, updateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";

import { required } from "@/lib/required";
import { getMatchById, updateMatch } from "@/modules/matches/server";
import {
  getTournamentById,
  updateTournament,
} from "@/modules/tournaments/server";
import { clearCacheMocks } from "@/test/cache-mocks";
import {
  holdTransaction,
  lockRowsWhere,
  waitForLockWaits,
} from "@/test/db/locks";
import { withTransaction } from "@/test/db/seed";
import { createFixtures } from "@/test/fixtures";
import { invalidatedPaths, roundChangedPaths } from "@/test/round-changed";
import * as eventRounds from "../server";
import { changeRoundSettings, recordScorecardChanges } from "../server";

describe("Event Rounds", () => {
  const fixtures = createFixtures();

  async function roundRow(id: number) {
    return (await eventRounds.getRoundById(id)) ?? null;
  }

  // Ids of the Rounds whose pages were refreshed, which are the Rounds a
  // write changed.
  function refreshedRoundIds() {
    return vi
      .mocked(revalidatePath)
      .mock.calls.map(([path]) => /^\/rounds\/(\d+)$/.exec(path)?.[1])
      .filter((id) => id !== undefined)
      .map(Number)
      .sort((a, b) => a - b);
  }

  function sortedIds(...ids: number[]) {
    return ids.sort((a, b) => a - b);
  }

  describe("event Round helpers", () => {
    it("inserts Tournament Rounds on the Tournament's course, tee and date", async () => {
      const t = await fixtures.tournament();
      const a = await fixtures.player();
      const b = await fixtures.player();

      const inserted = await withTransaction((tx) =>
        eventRounds.insertEventRounds(tx, { tournamentId: t.tournament.id }, [
          a.id,
          b.id,
        ]),
      );

      expect(inserted).toHaveLength(2);
      for (const round of inserted) {
        expect(await roundRow(round.id)).toMatchObject({
          kind: "tournament",
          tournamentId: t.tournament.id,
          courseId: t.course.id,
          teeId: t.tee.id,
          date: t.tournament.date,
        });
      }
      expect(inserted.map((round) => round.playerId).sort()).toEqual(
        [a.id, b.id].sort(),
      );
    });

    it("skips players who already have a Round in the event", async () => {
      const t = await fixtures.tournament();
      const existing = await fixtures.tournamentPlayer(t);
      const newcomer = await fixtures.player();

      const inserted = await withTransaction((tx) =>
        eventRounds.insertEventRounds(tx, { tournamentId: t.tournament.id }, [
          existing.player.id,
          newcomer.id,
        ]),
      );

      expect(inserted.map((round) => round.playerId)).toEqual([newcomer.id]);
    });

    it("inserts Match Rounds on the Match's course and date with the given tee", async () => {
      const { match } = await fixtures.match(1);
      const white = await fixtures.tee(match.courseHandle);
      const player = await fixtures.player();

      const [inserted] = await withTransaction((tx) =>
        eventRounds.insertEventRounds(
          tx,
          { matchId: match.id, teeId: white.id },
          [player.id],
        ),
      );

      expect(await roundRow(inserted.id)).toMatchObject({
        kind: "match",
        matchId: match.id,
        playerId: player.id,
        courseId: match.courseId,
        teeId: white.id,
        date: match.date,
      });
    });

    it("deletes a Match's Rounds and returns them", async () => {
      const { match, players } = await fixtures.match(2);

      const deleted = await withTransaction((tx) =>
        eventRounds.deleteEventRounds(tx, { matchId: match.id }),
      );

      expect(deleted.map((round) => round.id).sort()).toEqual(
        players.map((p) => p.round.id).sort(),
      );
      for (const p of players) expect(await roundRow(p.round.id)).toBeNull();
    });

    it("refreshes the Round changed pages of the Rounds it's given, leaving home events to the caller", async () => {
      const { players } = await fixtures.match(1);
      const t = await fixtures.tournament();
      const entrant = await fixtures.tournamentPlayer(t);
      clearCacheMocks();

      eventRounds.invalidateRoundChanged([players[0].round, entrant.round]);

      expect(updateTag).not.toHaveBeenCalled();
      expect(invalidatedPaths(revalidatePath)).toEqual(
        roundChangedPaths(players[0].round, entrant.round),
      );
    });
  });

  describe("event Round sync", () => {
    type TournamentFixture = Awaited<ReturnType<typeof fixtures.tournament>>;

    // Saves the Tournament as an admin would, with `next` replacing its
    // course, tee or date, forgetting the arrange's cache invalidations.
    async function editTournament(
      t: TournamentFixture,
      next: { courseHandle?: string; teeId?: number; date?: string },
    ) {
      const admin = await fixtures.admin();
      clearCacheMocks();
      return updateTournament(admin, {
        id: t.tournament.id,
        clubHandle: t.club.handle,
        seasonId: required(t.tournament.seasonId, "season"),
        courseHandle: t.course.handle,
        teeId: t.tee.id,
        date: t.tournament.date.toISOString().slice(0, 10),
        ...next,
      });
    }

    async function score(roundId: number) {
      await fixtures.scores(roundId, [{ hole: 1, strokes: 4, putts: 2 }]);
    }

    async function greenie(roundId: number) {
      await fixtures.greenie(roundId, 3, { feet: 6, inches: 0 });
    }

    it("moves every unscored Tournament Round to the new course and the Tournament's tee", async () => {
      const t = await fixtures.tournament();
      const a = await fixtures.tournamentPlayer(t);
      const b = await fixtures.tournamentPlayer(t);
      const next = await fixtures.course();

      expect(
        await editTournament(t, {
          courseHandle: next.course.handle,
          teeId: next.tee.id,
        }),
      ).toEqual({ ok: true });

      expect(refreshedRoundIds()).toEqual(sortedIds(a.round.id, b.round.id));
      for (const p of [a, b]) {
        expect(await roundRow(p.round.id)).toMatchObject({
          courseId: next.course.id,
          teeId: next.tee.id,
          date: t.tournament.date,
        });
      }
    });

    it("refuses a course change naming the players with scores or only Greenies, changing nothing", async () => {
      const t = await fixtures.tournament();
      const scored = await fixtures.tournamentPlayer(t);
      const greenieOnly = await fixtures.tournamentPlayer(t);
      const unscored = await fixtures.tournamentPlayer(t);
      await score(scored.round.id);
      await greenie(greenieOnly.round.id);
      const next = await fixtures.course();

      const result = await editTournament(t, {
        courseHandle: next.course.handle,
        teeId: next.tee.id,
      });

      if (result.ok) throw new Error("course change was allowed");
      const message = result.error;
      expect(message).toContain(`Player ${scored.player.lastName}`);
      expect(message).toContain(`Player ${greenieOnly.player.lastName}`);
      expect(message).not.toContain(unscored.player.lastName);
      expect((await getTournamentById(t.tournament.id))?.courseId).toBe(
        t.course.id,
      );
      for (const p of [scored, greenieOnly, unscored]) {
        expect(await roundRow(p.round.id)).toMatchObject({
          courseId: t.course.id,
          teeId: t.tee.id,
        });
      }
    });

    it("refuses a course change when the only Round has just Greenies", async () => {
      const t = await fixtures.tournament();
      const p = await fixtures.tournamentPlayer(t);
      await greenie(p.round.id);
      const next = await fixtures.course();

      expect(
        await editTournament(t, {
          courseHandle: next.course.handle,
          teeId: next.tee.id,
        }),
      ).toEqual({
        ok: false,
        error: expect.stringContaining(
          `Player ${p.player.lastName} already has scores or Greenies`,
        ),
      });
    });

    it("refuses a course change behind a scorecard write in flight, keeping its score on the old course", async () => {
      const t = await fixtures.tournament();
      const p = await fixtures.tournamentPlayer(t);
      // Filling in an existing hole row never touches the Round's foreign key.
      await fixtures.scores(p.round.id, [{ hole: 1, strokes: null }]);
      const next = await fixtures.course();
      // Pins the hole row so the scorecard write stalls mid-transaction.
      const pin = await holdTransaction((tx) =>
        lockRowsWhere(tx, "round_scores", { round_id: p.round.id, hole: 1 }),
      );

      const writing = recordScorecardChanges(p.player.id, {
        scores: [{ roundId: p.round.id, hole: 1, strokes: 4 }],
      });
      let editing: Promise<unknown> | undefined;
      try {
        await waitForLockWaits("round_scores", 1);
        editing = editTournament(t, {
          courseHandle: next.course.handle,
          teeId: next.tee.id,
        });
        await waitForLockWaits("rounds", 1);
      } finally {
        pin.release();
        await pin.done;
      }
      const [write, edit] = await Promise.all([writing, editing]);

      expect(write).toEqual({ ok: true });
      expect(edit).toEqual({
        ok: false,
        error: expect.stringContaining("already has scores or Greenies"),
      });
      expect(await roundRow(p.round.id)).toMatchObject({
        courseId: t.course.id,
        teeId: t.tee.id,
      });
    });

    it("carries a date change to every Round, scored or not", async () => {
      const t = await fixtures.tournament();
      const scored = await fixtures.tournamentPlayer(t);
      const unscored = await fixtures.tournamentPlayer(t);
      await score(scored.round.id);
      const date = new Date("2026-02-14T00:00:00.000Z");

      expect(await editTournament(t, { date: "2026-02-14" })).toEqual({
        ok: true,
      });

      expect(refreshedRoundIds()).toEqual(
        sortedIds(scored.round.id, unscored.round.id),
      );
      for (const p of [scored, unscored]) {
        expect(await roundRow(p.round.id)).toMatchObject({
          date,
          courseId: t.course.id,
        });
      }
    });

    it("moves unscored Rounds on the old Tournament tee and leaves player-chosen and scored tees", async () => {
      const t = await fixtures.tournament();
      const onEventTee = await fixtures.tournamentPlayer(t);
      const chosen = await fixtures.tournamentPlayer(t);
      const scored = await fixtures.tournamentPlayer(t);
      await score(scored.round.id);
      const red = await fixtures.tee(t.course.handle, "Red");
      expect(
        await changeRoundSettings(chosen.player.id, chosen.round.id, {
          teeId: red.id,
        }),
      ).toEqual({ ok: true });
      const white = await fixtures.tee(t.course.handle);

      expect(await editTournament(t, { teeId: white.id })).toEqual({
        ok: true,
      });

      expect(refreshedRoundIds()).toEqual([onEventTee.round.id]);
      expect((await roundRow(onEventTee.round.id))?.teeId).toBe(white.id);
      expect((await roundRow(chosen.round.id))?.teeId).toBe(red.id);
      expect((await roundRow(scored.round.id))?.teeId).toBe(t.tee.id);
    });

    describe("Match", () => {
      type MatchFixture = Awaited<ReturnType<typeof fixtures.match>>;

      // Saves the Match as its creator would, forgetting the arrange's cache
      // invalidations.
      async function editMatch(
        m: MatchFixture,
        next: Partial<Parameters<typeof updateMatch>[1]>,
      ) {
        clearCacheMocks();
        return updateMatch(m.creator.id, {
          id: m.match.id,
          date: "2026-01-01",
          courseHandle: m.match.courseHandle,
          format: m.match.format,
          teeId: m.tee.id,
          playerIds: m.players.map((p) => p.player.id),
          teamOnePlayerIds: [],
          teamTwoPlayerIds: [],
          teamOneRoundIds: [],
          teamTwoRoundIds: [],
          ...next,
        });
      }

      it("moves unscored Rounds to the new course and the submitted tee, and repairs on the same course", async () => {
        const m = await fixtures.match(3);
        const next = await fixtures.course();
        const fourth = await fixtures.player();
        const [a, b, d] = m.players.map((p) => p.player.id);

        expect(
          await editMatch(m, {
            courseHandle: next.course.handle,
            teeId: next.tee.id,
            format: "four_ball_match_play",
            playerIds: [a, b, d, fourth.id],
            teamOnePlayerIds: [a, fourth.id],
            teamTwoPlayerIds: [b, d],
          }),
        ).toEqual({ ok: true });

        const matchRounds = required(
          await getMatchById(m.match.id),
          "match",
        ).rounds;
        expect(matchRounds).toHaveLength(4);
        expect(refreshedRoundIds()).toEqual(
          sortedIds(...matchRounds.map((round) => round.id)),
        );
        for (const round of matchRounds) {
          expect(round).toMatchObject({
            courseId: next.course.id,
            teeId: next.tee.id,
          });
        }
      });

      it("refuses a course change once any Round has scores", async () => {
        const m = await fixtures.match(2);
        await score(m.players[0].round.id);
        const next = await fixtures.course();

        expect(
          await editMatch(m, {
            courseHandle: next.course.handle,
            teeId: next.tee.id,
          }),
        ).toEqual({
          ok: false,
          error: expect.stringContaining("already has scores or Greenies"),
        });
        expect((await getMatchById(m.match.id))?.courseId).toBe(
          m.match.courseId,
        );
        for (const p of m.players) {
          expect((await roundRow(p.round.id))?.courseId).toBe(m.match.courseId);
        }
      });

      it("carries a date change to every Round, scored or not, keeping tees", async () => {
        const m = await fixtures.match(2);
        await score(m.players[0].round.id);
        const other = await fixtures.tee(m.match.courseHandle);
        const date = new Date("2026-03-01T00:00:00.000Z");

        expect(
          await editMatch(m, { date: "2026-03-01", teeId: other.id }),
        ).toEqual({ ok: true });

        expect(refreshedRoundIds()).toEqual(
          sortedIds(...m.players.map((p) => p.round.id)),
        );
        for (const p of m.players) {
          expect(await roundRow(p.round.id)).toMatchObject({
            date,
            teeId: p.round.teeId,
          });
        }
      });
    });
  });
});
