import { beforeEach, describe, expect, it, vi } from "vitest";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import * as lifecycle from "./lifecycle";
import * as scorecardWrites from "./scorecard-writes";
import { createRoundFixtures } from "./test-fixtures";

const { revalidatePath, updateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath, updateTag }));

describe("Round lifecycle", () => {
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

  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

  // Runs `body` in a transaction on its own connection and keeps it open,
  // holding its locks, until release() is called.
  async function holdTransaction(body: (tx: Tx) => Promise<unknown>) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let ready!: () => void;
    const started = new Promise<void>((resolve) => (ready = resolve));
    const done = db.transaction(async (tx) => {
      await body(tx);
      ready();
      await gate;
    });
    await Promise.race([started, done]);
    return { release, done };
  }

  // Waits until `count` queries touching `table` are queued behind a lock.
  async function waitForLockWaits(table: string, count: number) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const { rows } = await db.execute<{ waiting: number }>(sql`
        select count(*)::int as waiting from pg_stat_activity
        where datname = current_database()
          and wait_event_type = 'Lock'
          and query ilike ${`%${table}%`}`);
      if (rows[0].waiting >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Expected ${count} queries on ${table} waiting on a lock.`);
  }

  beforeEach(() => {
    revalidatePath.mockClear();
    updateTag.mockClear();
  });

  describe("create Round", () => {
    it("creates a casual Round on the chosen tee without touching home events", async () => {
      const { course, tee } = await fixtures.course();
      const player = await fixtures.player();

      const result = await lifecycle.createRound(player.id, {
        courseHandle: course.handle,
        date: "2026-03-04",
        tournamentId: null,
        teeId: tee.id,
      });

      if (!result.ok) throw new Error(result.error);
      expect(await roundRow(result.roundId)).toMatchObject({
        playerId: player.id,
        courseId: course.id,
        teeId: tee.id,
        tournamentId: null,
        matchId: null,
        date: new Date("2026-03-04T00:00:00.000Z"),
      });
      expect(invalidatedPaths()).toEqual(
        roundChangedPaths({ id: result.roundId, playerId: player.id }),
      );
      expect(updateTag).not.toHaveBeenCalled();
    });

    it("refuses a casual Round on a tee from another course", async () => {
      const { course } = await fixtures.course();
      const other = await fixtures.course();
      const player = await fixtures.player();

      expect(
        await lifecycle.createRound(player.id, {
          courseHandle: course.handle,
          date: "2026-03-04",
          tournamentId: null,
          teeId: other.tee.id,
        }),
      ).toEqual({
        ok: false,
        error: "Selected tees do not belong to this course.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("refuses a casual Round without tees", async () => {
      const { course } = await fixtures.course();
      const player = await fixtures.player();

      expect(
        await lifecycle.createRound(player.id, {
          courseHandle: course.handle,
          date: "2026-03-04",
          tournamentId: null,
          teeId: null,
        }),
      ).toEqual({ ok: false, error: "Tees are required." });
    });

    it("joins a Tournament on its tee and refreshes home events", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.player();

      const result = await lifecycle.createRound(player.id, {
        courseHandle: t.course.handle,
        date: "2026-01-01",
        tournamentId: t.tournament.id,
        teeId: null,
      });

      if (!result.ok) throw new Error(result.error);
      expect(await roundRow(result.roundId)).toMatchObject({
        playerId: player.id,
        tournamentId: t.tournament.id,
        courseId: t.course.id,
        teeId: t.tee.id,
      });
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths()).toEqual(
        roundChangedPaths({
          id: result.roundId,
          playerId: player.id,
          tournamentId: t.tournament.id,
        }),
      );
    });

    it("joins a Tournament on its date and course whatever the form says", async () => {
      const t = await fixtures.tournament();
      const other = await fixtures.course();
      const player = await fixtures.player();

      const result = await lifecycle.createRound(player.id, {
        courseHandle: other.course.handle,
        date: "2026-05-05",
        tournamentId: t.tournament.id,
        teeId: other.tee.id,
      });

      if (!result.ok) throw new Error(result.error);
      expect(await roundRow(result.roundId)).toMatchObject({
        courseId: t.course.id,
        teeId: t.tee.id,
        date: t.tournament.date,
      });
    });

    it("joins on the Tournament's new course when an edit of it is in flight", async () => {
      const t = await fixtures.tournament();
      const next = await fixtures.course();
      const player = await fixtures.player();
      const edit = await holdTransaction(async (tx) => {
        await tx
          .select({ id: schema.tournaments.id })
          .from(schema.tournaments)
          .where(eq(schema.tournaments.id, t.tournament.id))
          .for("update");
        await tx
          .update(schema.tournaments)
          .set({ courseId: next.course.id, teeId: next.tee.id })
          .where(eq(schema.tournaments.id, t.tournament.id));
      });

      const join = lifecycle.createRound(player.id, {
        courseHandle: t.course.handle,
        date: "2026-01-01",
        tournamentId: t.tournament.id,
        teeId: null,
      });
      try {
        await waitForLockWaits("tournaments", 1);
      } finally {
        edit.release();
        await edit.done;
      }
      const result = await join;

      if (!result.ok) throw new Error(result.error);
      expect(await roundRow(result.roundId)).toMatchObject({
        courseId: next.course.id,
        teeId: next.tee.id,
      });
    });

    it("refuses joining a Tournament twice", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);

      expect(
        await lifecycle.createRound(player.player.id, {
          courseHandle: t.course.handle,
          date: "2026-01-01",
          tournamentId: t.tournament.id,
          teeId: null,
        }),
      ).toEqual({
        ok: false,
        error: "You already have a round for this tournament.",
      });
    });
  });

  describe("delete Round", () => {
    it("lets the Round's player delete it, refreshing the home events cache", async () => {
      const { match, players } = await fixtures.match(2);
      const [a] = players;

      expect(await lifecycle.deleteRound(a.player.id, a.round.id)).toEqual({
        ok: true,
      });

      expect(await roundRow(a.round.id)).toBeNull();
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths()).toEqual(
        roundChangedPaths({
          id: a.round.id,
          playerId: a.player.id,
          matchId: match.id,
        }),
      );
    });

    it("lets an admin delete someone else's Round", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const admin = await fixtures.player({ isAdmin: true });

      expect(
        await lifecycle.deleteRound(admin.id, player.round.id),
      ).toEqual({ ok: true });
      expect(await roundRow(player.round.id)).toBeNull();
    });

    it("gives a Scorer who can't manage the Round a distinct error and keeps it", async () => {
      const { players } = await fixtures.match(2);
      const [a, b] = players;

      expect(await lifecycle.deleteRound(b.player.id, a.round.id)).toMatchObject({
        ok: false,
        error: "You can't delete this Round.",
      });
      expect(await roundRow(a.round.id)).not.toBeNull();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("waits for an edit of the Round's Match before deleting", async () => {
      const { match, players } = await fixtures.match(2);
      const [a] = players;
      const edit = await holdTransaction((tx) =>
        tx
          .select({ id: schema.matches.id })
          .from(schema.matches)
          .where(eq(schema.matches.id, match.id))
          .for("update"),
      );

      const deletion = lifecycle.deleteRound(a.player.id, a.round.id);
      try {
        await waitForLockWaits("matches", 1);
        expect(await roundRow(a.round.id)).not.toBeNull();
      } finally {
        edit.release();
        await edit.done;
      }

      expect(await deletion).toEqual({ ok: true });
      expect(await roundRow(a.round.id)).toBeNull();
    });

    it("reports not found to someone who can't score the Round", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const stranger = await fixtures.tournamentPlayer(t);

      expect(
        await lifecycle.deleteRound(stranger.player.id, player.round.id),
      ).toMatchObject({ ok: false, error: "Round not found." });
      expect(await roundRow(player.round.id)).not.toBeNull();
    });
  });

  describe("event Round helpers", () => {
    it("inserts Tournament Rounds on the Tournament's course, tee and date", async () => {
      const t = await fixtures.tournament();
      const a = await fixtures.player();
      const b = await fixtures.player();

      const inserted = await db.transaction((tx) =>
        lifecycle.insertEventRounds(
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
        lifecycle.insertEventRounds(
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
        lifecycle.insertEventRounds(
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
        lifecycle.deleteEventRounds(tx, { matchId: match.id }),
      );

      expect(deleted.map((round) => round.id).sort()).toEqual(
        players.map((p) => p.round.id).sort(),
      );
      for (const p of players) expect(await roundRow(p.round.id)).toBeNull();
    });

    it("refreshes Round changed pages and home events for created or deleted event Rounds", async () => {
      const { match, players } = await fixtures.match(1);
      const [{ round }] = players;

      lifecycle.invalidateRoundsAddedOrRemoved([round]);

      expect(updateTag).toHaveBeenCalledWith("home-events");
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
        return lifecycle.syncEventRounds(
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

      expect(error).toBeInstanceOf(lifecycle.EventCourseLockedError);
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

      const writing = scorecardWrites.recordScorecardChanges(p.player.id, {
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
      expect(edit).toBeInstanceOf(lifecycle.EventCourseLockedError);
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
          const synced = await lifecycle.syncEventRounds(
            tx,
            { matchId: m.match.id, teeId },
            previous,
          );
          const repaired = await lifecycle.insertEventRounds(
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
        ).rejects.toThrow(lifecycle.EventCourseLockedError);
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
