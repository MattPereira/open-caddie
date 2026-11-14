import { beforeEach, describe, expect, it, vi } from "vitest";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { holdTransaction, waitForLockWaits } from "@/test/db/locks";
import { createRoundFixtures } from "@/test/fixtures/rounds";
import { invalidatedPaths, roundChangedPaths } from "@/test/round-changed";
import * as rounds from "../index";

const { revalidatePath, updateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath, updateTag }));

describe("Round writes", () => {
  const fixtures = createRoundFixtures(db, schema);

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
      expect(invalidatedPaths(revalidatePath)).toEqual(
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
      expect(invalidatedPaths(revalidatePath)).toEqual(
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
      const { players } = await fixtures.match(2);
      const [a] = players;

      expect(await rounds.deleteRound(a.player.id, a.round.id)).toEqual({
        ok: true,
      });

      expect(await roundRow(a.round.id)).toBeNull();
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths(revalidatePath)).toEqual(
        roundChangedPaths(a.round),
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
});
