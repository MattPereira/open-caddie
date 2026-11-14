import { beforeEach, describe, expect, it, vi } from "vitest";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { holdTransaction, waitForLockWaits } from "@/test/db-locks";
import { createRoundFixtures } from "@/test/fixtures/rounds";
import * as eventRounds from "../event-rounds";
import { recordScorecardChanges } from "../index";

const { revalidatePath, updateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath, updateTag }));

describe("Event Rounds", () => {
  const fixtures = createRoundFixtures(db, schema);

  function invalidatedPaths() {
    return (revalidatePath.mock.calls as unknown as string[][])
      .map((call) => call.join(" "))
      .sort();
  }

  function roundChangedPaths(round: {
    id: number;
    playerId: string;
    tournamentId?: number | null;
    matchId?: number | null;
  }) {
    return [
      ["/"],
      ["/records"],
      ["/clubs/[handle]", "page"],
      [`/players/${round.playerId}`],
      [`/rounds/${round.id}`],
      ...(round.tournamentId != null
        ? [[`/tournaments/${round.tournamentId}`]]
        : []),
      ...(round.matchId != null ? [[`/matches/${round.matchId}`]] : []),
    ]
      .map((call) => call.join(" "))
      .sort();
  }

  async function roundRow(id: number) {
    const [round] = await db
      .select()
      .from(schema.rounds)
      .where(eq(schema.rounds.id, id));
    return round ?? null;
  }

  beforeEach(() => {
    revalidatePath.mockClear();
    updateTag.mockClear();
  });

  describe("event Round helpers", () => {
    it("inserts Tournament Rounds on the Tournament's course, tee and date", async () => {
      const t = await fixtures.tournament();
      const a = await fixtures.player();
      const b = await fixtures.player();

      const inserted = await db.transaction((tx) =>
        eventRounds.insertEventRounds(
          tx,
          { tournamentId: t.tournament.id },
          [a.id, b.id],
        ),
      );

      expect(inserted).toHaveLength(2);
      for (const round of inserted) {
        expect(await roundRow(round.id)).toMatchObject({
          tournamentId: t.tournament.id,
          matchId: null,
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

      const inserted = await db.transaction((tx) =>
        eventRounds.insertEventRounds(
          tx,
          { tournamentId: t.tournament.id },
          [existing.player.id, newcomer.id],
        ),
      );

      expect(inserted.map((round) => round.playerId)).toEqual([newcomer.id]);
    });

    it("inserts Match Rounds on the Match's course and date with the given tee", async () => {
      const { match } = await fixtures.match(1);
      const white = await fixtures.tee(match.courseId);
      const player = await fixtures.player();

      const [inserted] = await db.transaction((tx) =>
        eventRounds.insertEventRounds(
          tx,
          { matchId: match.id, teeId: white.id },
          [player.id],
        ),
      );

      expect(await roundRow(inserted.id)).toMatchObject({
        matchId: match.id,
        tournamentId: null,
        playerId: player.id,
        courseId: match.courseId,
        teeId: white.id,
        date: match.date,
      });
    });

    it("deletes a Match's Rounds and returns them", async () => {
      const { match, players } = await fixtures.match(2);

      const deleted = await db.transaction((tx) =>
        eventRounds.deleteEventRounds(tx, { matchId: match.id }),
      );

      expect(deleted.map((round) => round.id).sort()).toEqual(
        players.map((p) => p.round.id).sort(),
      );
      for (const p of players) expect(await roundRow(p.round.id)).toBeNull();
    });

    it("refreshes the Round changed pages of the Rounds it's given, leaving home events to the caller", async () => {
      const { match, players } = await fixtures.match(1);
      const [{ round }] = players;

      eventRounds.invalidateRoundChanged([round]);

      expect(updateTag).not.toHaveBeenCalled();
      expect(invalidatedPaths()).toEqual(
        roundChangedPaths({
          id: round.id,
          playerId: round.playerId,
          matchId: match.id,
        }),
      );
    });
  });

  describe("event Round sync", () => {
    type TournamentFixture = Awaited<ReturnType<typeof fixtures.tournament>>;

    // Edits the Tournament row the way an authorized caller would, then
    // syncs its Rounds in the same transaction.
    async function editTournament(
      t: TournamentFixture,
      next: { courseId?: number; teeId?: number; date?: Date },
    ) {
      const previous = {
        courseId: t.tournament.courseId,
        teeId: t.tournament.teeId,
        date: t.tournament.date,
      };
      return db.transaction(async (tx) => {
        await tx
          .update(schema.tournaments)
          .set(next)
          .where(eq(schema.tournaments.id, t.tournament.id));
        return eventRounds.syncEventRounds(
          tx,
          { tournamentId: t.tournament.id },
          previous,
        );
      });
    }

    async function score(roundId: number) {
      await db
        .insert(schema.roundScores)
        .values({ roundId, hole: 1, strokes: 4, putts: 2 });
    }

    async function greenie(roundId: number) {
      await db.insert(schema.roundScores).values({ roundId, hole: 3 });
      await db
        .insert(schema.greenies)
        .values({ roundId, hole: 3, feet: 6, inches: 0 });
    }

    it("moves every unscored Tournament Round to the new course and the Tournament's tee", async () => {
      const t = await fixtures.tournament();
      const a = await fixtures.tournamentPlayer(t);
      const b = await fixtures.tournamentPlayer(t);
      const next = await fixtures.course();

      const moved = await editTournament(t, {
        courseId: next.course.id,
        teeId: next.tee.id,
      });

      expect(moved.map((r) => r.id).sort()).toEqual(
        [a.round.id, b.round.id].sort(),
      );
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

      const error = await editTournament(t, {
        courseId: next.course.id,
        teeId: next.tee.id,
      }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(eventRounds.EventCourseLockedError);
      const message = (error as Error).message;
      expect(message).toContain(`Player ${scored.player.lastName}`);
      expect(message).toContain(`Player ${greenieOnly.player.lastName}`);
      expect(message).not.toContain(unscored.player.lastName);
      const [tournament] = await db
        .select()
        .from(schema.tournaments)
        .where(eq(schema.tournaments.id, t.tournament.id));
      expect(tournament.courseId).toBe(t.course.id);
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

      await expect(
        editTournament(t, { courseId: next.course.id, teeId: next.tee.id }),
      ).rejects.toThrow(`Player ${p.player.lastName} already has scores or Greenies`);
    });

    it("refuses a course change behind a scorecard write in flight, keeping its score on the old course", async () => {
      const t = await fixtures.tournament();
      const p = await fixtures.tournamentPlayer(t);
      // Filling in an existing hole row never touches the Round's foreign key.
      await db.insert(schema.roundScores).values({ roundId: p.round.id, hole: 1 });
      const next = await fixtures.course();
      // Pins the hole row so the scorecard write stalls mid-transaction.
      const pin = await holdTransaction((tx) =>
        tx
          .select({ hole: schema.roundScores.hole })
          .from(schema.roundScores)
          .where(
            and(
              eq(schema.roundScores.roundId, p.round.id),
              eq(schema.roundScores.hole, 1),
            ),
          )
          .for("update"),
      );

      const writing = recordScorecardChanges(p.player.id, {
        scores: [{ roundId: p.round.id, hole: 1, strokes: 4 }],
      });
      let editing: Promise<unknown> | undefined;
      try {
        await waitForLockWaits("round_scores", 1);
        editing = editTournament(t, {
          courseId: next.course.id,
          teeId: next.tee.id,
        }).catch((e: unknown) => e);
        await waitForLockWaits("rounds", 1);
      } finally {
        pin.release();
        await pin.done;
      }
      const [write, edit] = await Promise.all([writing, editing]);

      expect(write).toEqual({ ok: true });
      expect(edit).toBeInstanceOf(eventRounds.EventCourseLockedError);
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

      const changed = await editTournament(t, { date });

      expect(changed.map((r) => r.id).sort()).toEqual(
        [scored.round.id, unscored.round.id].sort(),
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
      const red = await fixtures.tee(t.course.id, "Red");
      await db
        .update(schema.rounds)
        .set({ teeId: red.id })
        .where(eq(schema.rounds.id, chosen.round.id));
      const white = await fixtures.tee(t.course.id);

      const changed = await editTournament(t, { teeId: white.id });

      expect(changed.map((r) => r.id)).toEqual([onEventTee.round.id]);
      expect((await roundRow(onEventTee.round.id))?.teeId).toBe(white.id);
      expect((await roundRow(chosen.round.id))?.teeId).toBe(red.id);
      expect((await roundRow(scored.round.id))?.teeId).toBe(t.tee.id);
    });

    describe("Match", () => {
      type MatchFixture = Awaited<ReturnType<typeof fixtures.match>>;

      async function editMatch(
        m: MatchFixture,
        next: { courseId?: number; date?: Date },
        teeId: number,
        repairPlayerIds: string[] = [],
      ) {
        const previous = { courseId: m.match.courseId, date: m.match.date };
        return db.transaction(async (tx) => {
          await tx
            .update(schema.matches)
            .set(next)
            .where(eq(schema.matches.id, m.match.id));
          const synced = await eventRounds.syncEventRounds(
            tx,
            { matchId: m.match.id, teeId },
            previous,
          );
          const repaired = await eventRounds.insertEventRounds(
            tx,
            { matchId: m.match.id, teeId },
            repairPlayerIds,
          );
          return { synced, repaired };
        });
      }

      it("moves unscored Rounds to the new course and the submitted tee, and repairs on the same course", async () => {
        const m = await fixtures.match(3);
        const next = await fixtures.course();
        const fourth = await fixtures.player();

        const { synced, repaired } = await editMatch(
          m,
          { courseId: next.course.id },
          next.tee.id,
          [fourth.id],
        );

        expect(synced).toHaveLength(3);
        expect(repaired).toHaveLength(1);
        const matchRounds = await db
          .select()
          .from(schema.rounds)
          .where(eq(schema.rounds.matchId, m.match.id));
        expect(matchRounds).toHaveLength(4);
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

        await expect(
          editMatch(m, { courseId: next.course.id }, next.tee.id),
        ).rejects.toThrow(eventRounds.EventCourseLockedError);
        const [match] = await db
          .select()
          .from(schema.matches)
          .where(eq(schema.matches.id, m.match.id));
        expect(match.courseId).toBe(m.match.courseId);
        for (const p of m.players) {
          expect((await roundRow(p.round.id))?.courseId).toBe(
            m.match.courseId,
          );
        }
      });

      it("carries a date change to every Round, scored or not, keeping tees", async () => {
        const m = await fixtures.match(2);
        await score(m.players[0].round.id);
        const other = await fixtures.tee(m.match.courseId);
        const date = new Date("2026-03-01T00:00:00.000Z");

        const { synced } = await editMatch(m, { date }, other.id);

        expect(synced).toHaveLength(2);
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
