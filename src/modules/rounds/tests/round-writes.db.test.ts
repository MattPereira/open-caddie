import { beforeEach, describe, expect, it, vi } from "vitest";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { createRoundFixtures, PAR_THREE_HOLES } from "@/test/fixtures/rounds";
import * as rounds from "../index";

const { revalidatePath, updateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath, updateTag }));

describe("Round writes", () => {
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

      const result = await rounds.createRound(player.id, {
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
        await rounds.createRound(player.id, {
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
        await rounds.createRound(player.id, {
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

      const result = await rounds.createRound(player.id, {
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

      const result = await rounds.createRound(player.id, {
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

      const join = rounds.createRound(player.id, {
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
        await rounds.createRound(player.player.id, {
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

      expect(await rounds.deleteRound(a.player.id, a.round.id)).toEqual({
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
        await rounds.deleteRound(admin.id, player.round.id),
      ).toEqual({ ok: true });
      expect(await roundRow(player.round.id)).toBeNull();
    });

    it("gives a Scorer who can't manage the Round a distinct error and keeps it", async () => {
      const { players } = await fixtures.match(2);
      const [a, b] = players;

      expect(await rounds.deleteRound(b.player.id, a.round.id)).toMatchObject({
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

      const deletion = rounds.deleteRound(a.player.id, a.round.id);
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
        await rounds.deleteRound(stranger.player.id, player.round.id),
      ).toMatchObject({ ok: false, error: "Round not found." });
      expect(await roundRow(player.round.id)).not.toBeNull();
    });
  });

  describe("record scorecard changes", () => {

    const PAR_THREE = PAR_THREE_HOLES[0];
    const PAR_FOUR = 1;

    async function scorecardOf(roundId: number) {
      const round = await rounds.getRoundById(roundId);
      return { scores: round?.scores ?? [], greenies: round?.greenies ?? [] };
    }

    async function holeOf(roundId: number, hole: number) {
      const scorecard = await scorecardOf(roundId);
      const score = scorecard.scores.find((s) => s.hole === hole);
      return { strokes: score?.strokes ?? null, putts: score?.putts ?? null };
    }

    async function greenieOf(roundId: number, hole: number) {
      const scorecard = await scorecardOf(roundId);
      const greenie = scorecard.greenies.find((g) => g.hole === hole);
      return greenie ? { feet: greenie.feet, inches: greenie.inches } : null;
    }

    function sortedPaths(calls: string[][]) {
      return calls.map((call) => call.join(" ")).sort();
    }

    async function settingsOf(roundId: number) {
      const [round] = await db
        .select({
          teeId: schema.rounds.teeId,
          playerIndexOverride: schema.rounds.playerIndexOverride,
        })
        .from(schema.rounds)
        .where(eq(schema.rounds.id, roundId));
      return round;
    }

    const CANNOT_MANAGE = "You can't change this Round's settings.";

    it("keeps a field that's left out and clears one that's explicitly null", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const roundId = player.round.id;
      await rounds.recordScorecardChanges(player.player.id, {
        scores: [{ roundId, hole: PAR_FOUR, strokes: 5, putts: 2 }],
      });

      expect(
        await rounds.recordScorecardChanges(player.player.id, {
          scores: [{ roundId, hole: PAR_FOUR, strokes: 4 }],
        }),
      ).toEqual({ ok: true });
      expect(await holeOf(roundId, PAR_FOUR)).toEqual({ strokes: 4, putts: 2 });

      await rounds.recordScorecardChanges(player.player.id, {
        scores: [{ roundId, hole: PAR_FOUR, putts: null }],
      });
      expect(await holeOf(roundId, PAR_FOUR)).toEqual({
        strokes: 4,
        putts: null,
      });
    });

    it("sets and clears a Greenie without touching the hole's score", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const roundId = player.round.id;
      await rounds.recordScorecardChanges(player.player.id, {
        scores: [{ roundId, hole: PAR_THREE, strokes: 3, putts: 1 }],
      });

      await rounds.recordScorecardChanges(player.player.id, {
        greenies: [
          { roundId, hole: PAR_THREE, distance: { feet: 12, inches: 4 } },
        ],
      });
      expect(await greenieOf(roundId, PAR_THREE)).toEqual({
        feet: 12,
        inches: 4,
      });

      await rounds.recordScorecardChanges(player.player.id, {
        greenies: [{ roundId, hole: PAR_THREE, distance: null }],
      });
      expect(await greenieOf(roundId, PAR_THREE)).toBeNull();
      expect(await holeOf(roundId, PAR_THREE)).toEqual({ strokes: 3, putts: 1 });
    });

    it("rejects a Greenie on a hole that isn't a par 3 and writes nothing", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const roundId = player.round.id;

      expect(
        await rounds.recordScorecardChanges(player.player.id, {
          scores: [{ roundId, hole: PAR_FOUR, strokes: 4 }],
          greenies: [
            { roundId, hole: PAR_FOUR, distance: { feet: 3, inches: 0 } },
          ],
        }),
      ).toMatchObject({
        ok: false,
        error: "Greenies can only be recorded on par 3 holes.",
      });
      expect(await holeOf(roundId, PAR_FOUR)).toEqual({
        strokes: null,
        putts: null,
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
      [{ strokes: 0 }, "Score is out of allowed range."],
      [{ putts: -1 }, "Score is out of allowed range."],
      [{ strokes: 4.5 }, "Score is out of allowed range."],
    ])("rejects out-of-range score %o", async (fields, error) => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const roundId = player.round.id;

      expect(
        await rounds.recordScorecardChanges(player.player.id, {
          scores: [
            { roundId, hole: 2, strokes: 4 },
            { roundId, hole: PAR_FOUR, ...fields },
          ],
        }),
      ).toMatchObject({ ok: false, error });
      expect(await holeOf(roundId, 2)).toEqual({ strokes: null, putts: null });
    });

    it.each([
      [{ feet: -1, inches: 0 }],
      [{ feet: 3, inches: 12 }],
    ])("rejects out-of-range Greenie distance %o", async (distance) => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const roundId = player.round.id;

      expect(
        await rounds.recordScorecardChanges(player.player.id, {
          greenies: [{ roundId, hole: PAR_THREE, distance }],
        }),
      ).toMatchObject({
        ok: false,
        error: "Greenie distance is out of allowed range.",
      });
      expect(await greenieOf(roundId, PAR_THREE)).toBeNull();
    });

    it("lets a Match creator who isn't playing record scores", async () => {
      const { creator, players } = await fixtures.match(2, {
        creatorPlays: false,
      });
      const roundId = players[0].round.id;

      expect(
        await rounds.recordScorecardChanges(creator.id, {
          scores: [{ roundId, hole: PAR_FOUR, strokes: 5, putts: 2 }],
        }),
      ).toEqual({ ok: true });
      expect(await holeOf(roundId, PAR_FOUR)).toEqual({ strokes: 5, putts: 2 });
    });

    it("reports not found to someone who can't score the Round", async () => {
      const t = await fixtures.tournament();
      const target = await fixtures.tournamentPlayer(t);
      const stranger = await fixtures.tournamentPlayer(t);

      expect(
        await rounds.recordScorecardChanges(stranger.player.id, {
          scores: [{ roundId: target.round.id, hole: PAR_FOUR, strokes: 5 }],
        }),
      ).toMatchObject({ ok: false, error: "Round not found." });
      expect(await holeOf(target.round.id, PAR_FOUR)).toEqual({
        strokes: null,
        putts: null,
      });
    });

    it("writes nothing in a multi-Round write when one Round isn't scoreable", async () => {
      const t = await fixtures.tournament();
      const marker = await fixtures.tournamentPlayer(t);
      const mate = await fixtures.tournamentPlayer(t);
      const outsider = await fixtures.tournamentPlayer(t);
      await fixtures.pairing(t.tournament.id, [marker.round.id, mate.round.id]);

      expect(
        await rounds.recordScorecardChanges(marker.player.id, {
          scores: [
            { roundId: marker.round.id, hole: PAR_FOUR, strokes: 4 },
            { roundId: mate.round.id, hole: PAR_FOUR, strokes: 5 },
            { roundId: outsider.round.id, hole: PAR_FOUR, strokes: 6 },
          ],
        }),
      ).toMatchObject({ ok: false, error: "Round not found." });
      for (const round of [marker.round, mate.round, outsider.round]) {
        expect(await holeOf(round.id, PAR_FOUR)).toEqual({
          strokes: null,
          putts: null,
        });
      }
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("invalidates the Round changed pages, including course records", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);

      await rounds.recordScorecardChanges(player.player.id, {
        scores: [{ roundId: player.round.id, hole: PAR_FOUR, strokes: 4 }],
      });

      expect(invalidatedPaths()).toEqual(
        sortedPaths([
          ["/"],
          ["/records"],
          ["/clubs/[handle]", "page"],
          [`/players/${player.player.id}`],
          [`/rounds/${player.round.id}`],
          [`/tournaments/${t.tournament.id}`],
        ]),
      );
    });

    it("invalidates the union of every Round's pages in a multi-Round write", async () => {
      const { match, players } = await fixtures.match(2);
      const [a, b] = players;

      await rounds.recordScorecardChanges(a.player.id, {
        scores: [{ roundId: a.round.id, hole: PAR_FOUR, strokes: 4 }],
        greenies: [
          {
            roundId: b.round.id,
            hole: PAR_THREE,
            distance: { feet: 8, inches: 0 },
          },
        ],
      });

      expect(invalidatedPaths()).toEqual(
        sortedPaths([
          ["/"],
          ["/records"],
          ["/clubs/[handle]", "page"],
          [`/players/${a.player.id}`],
          [`/players/${b.player.id}`],
          [`/rounds/${a.round.id}`],
          [`/rounds/${b.round.id}`],
          [`/matches/${match.id}`],
        ]),
      );
    });
    describe("change Round settings", () => {
      it("keeps a Pairing mate's live score when the Round's player changes tees", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);
        const mate = await fixtures.tournamentPlayer(t);
        await fixtures.pairing(t.tournament.id, [
          player.round.id,
          mate.round.id,
        ]);
        const white = await fixtures.tee(t.course.id);
        await rounds.recordScorecardChanges(player.player.id, {
          scores: [{ roundId: player.round.id, hole: 1, strokes: 5, putts: 2 }],
        });
        // Entered from the mate's phone after the player's page loaded.
        await rounds.recordScorecardChanges(mate.player.id, {
          scores: [{ roundId: player.round.id, hole: 2, strokes: 3, putts: 1 }],
          greenies: [
            {
              roundId: player.round.id,
              hole: PAR_THREE,
              distance: { feet: 9, inches: 2 },
            },
          ],
        });

        expect(
          await rounds.changeRoundSettings(player.player.id, player.round.id, {
            teeId: white.id,
          }),
        ).toEqual({ ok: true });

        expect((await settingsOf(player.round.id)).teeId).toBe(white.id);
        expect(await holeOf(player.round.id, 1)).toEqual({
          strokes: 5,
          putts: 2,
        });
        expect(await holeOf(player.round.id, 2)).toEqual({
          strokes: 3,
          putts: 1,
        });
        expect(await greenieOf(player.round.id, PAR_THREE)).toEqual({
          feet: 9,
          inches: 2,
        });
      });

      it("rejects a tee from another course", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);
        const { tee: elsewhere } = await fixtures.course();

        expect(
          await rounds.changeRoundSettings(player.player.id, player.round.id, {
            teeId: elsewhere.id,
          }),
        ).toMatchObject({
          ok: false,
          error: "Selected tees do not belong to this course.",
        });
        expect((await settingsOf(player.round.id)).teeId).toBe(t.tee.id);
      });

      it("rejects a Player Index Override on a non-Match Round", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);
        const white = await fixtures.tee(t.course.id);

        expect(
          await rounds.changeRoundSettings(player.player.id, player.round.id, {
            teeId: white.id,
            playerIndexOverride: 12.3,
          }),
        ).toMatchObject({
          ok: false,
          error: "A Player Index Override can only be set on a Match Round.",
        });
        expect(await settingsOf(player.round.id)).toEqual({
          teeId: t.tee.id,
          playerIndexOverride: null,
        });
      });

      it("sets and clears a Player Index Override on a Match Round", async () => {
        const { players } = await fixtures.match(2);
        const [a] = players;

        await rounds.changeRoundSettings(a.player.id, a.round.id, {
          playerIndexOverride: 12.3,
        });
        expect((await settingsOf(a.round.id)).playerIndexOverride).toBe("12.3");

        await rounds.changeRoundSettings(a.player.id, a.round.id, {
          playerIndexOverride: null,
        });
        expect((await settingsOf(a.round.id)).playerIndexOverride).toBeNull();
      });

      it("gives a Scorer who can't manage the Round a distinct error", async () => {
        const { players, match } = await fixtures.match(2);
        const [a, b] = players;
        const white = await fixtures.tee(match.courseId);

        expect(
          await rounds.changeRoundSettings(b.player.id, a.round.id, {
            teeId: white.id,
          }),
        ).toMatchObject({ ok: false, error: CANNOT_MANAGE });
        expect((await settingsOf(a.round.id)).teeId).not.toBe(white.id);
      });

      it("reports not found to someone who can't score the Round", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);
        const stranger = await fixtures.tournamentPlayer(t);

        expect(
          await rounds.changeRoundSettings(stranger.player.id, player.round.id, {
            teeId: t.tee.id,
          }),
        ).toMatchObject({ ok: false, error: "Round not found." });
      });

      it("invalidates the Round changed pages but not the home events cache", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);
        const white = await fixtures.tee(t.course.id);

        await rounds.changeRoundSettings(player.player.id, player.round.id, {
          teeId: white.id,
        });

        expect(invalidatedPaths()).toEqual(
          sortedPaths([
            ["/"],
            ["/records"],
            ["/clubs/[handle]", "page"],
            [`/players/${player.player.id}`],
            [`/rounds/${player.round.id}`],
            [`/tournaments/${t.tournament.id}`],
          ]),
        );
        expect(updateTag).not.toHaveBeenCalled();
      });
    });
  });
});
