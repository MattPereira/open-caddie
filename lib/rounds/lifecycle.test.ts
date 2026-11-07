import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath, updateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath, updateTag }));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe.skip("Round lifecycle", () => {
    it("requires TEST_DATABASE_URL", () => {});
  });
} else {
  describe("Round lifecycle", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.DATABASE_DRIVER = "node-postgres";
    const [
      { db },
      schema,
      lifecycle,
      { createRoundFixtures },
    ] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("./lifecycle"),
      import("./test-fixtures"),
    ]);
    const { eq } = await import("drizzle-orm");
    const fixtures = createRoundFixtures(db, schema);

    function invalidatedPaths() {
      return (revalidatePath.mock.calls as unknown as string[][])
        .map((call) => call.join(" "))
        .sort();
    }

    function roundChangedPaths(round: {
      id: number;
      userId: string;
      tournamentId?: number | null;
      matchId?: number | null;
    }) {
      return [
        ["/"],
        ["/records"],
        ["/clubs/[handle]", "page"],
        [`/players/${round.userId}`],
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

    afterEach(async () => {
      await fixtures.cleanup();
    });

    describe("create Round", () => {
      it("creates a casual Round on the chosen tee without touching home events", async () => {
        const { course, tee } = await fixtures.course();
        const player = await fixtures.user();

        const result = await lifecycle.createRound(player.id, {
          courseHandle: course.handle,
          date: "2026-03-04",
          tournamentId: null,
          teeId: tee.id,
        });

        if (!result.ok) throw new Error(result.error);
        expect(await roundRow(result.roundId)).toMatchObject({
          userId: player.id,
          courseId: course.id,
          teeId: tee.id,
          tournamentId: null,
          matchId: null,
          date: new Date("2026-03-04T00:00:00.000Z"),
        });
        expect(invalidatedPaths()).toEqual(
          roundChangedPaths({ id: result.roundId, userId: player.id }),
        );
        expect(updateTag).not.toHaveBeenCalled();
      });

      it("refuses a casual Round on a tee from another course", async () => {
        const { course } = await fixtures.course();
        const other = await fixtures.course();
        const player = await fixtures.user();

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
        const player = await fixtures.user();

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
        const player = await fixtures.user();

        const result = await lifecycle.createRound(player.id, {
          courseHandle: t.course.handle,
          date: "2026-01-01",
          tournamentId: t.tournament.id,
          teeId: null,
        });

        if (!result.ok) throw new Error(result.error);
        expect(await roundRow(result.roundId)).toMatchObject({
          userId: player.id,
          tournamentId: t.tournament.id,
          courseId: t.course.id,
          teeId: t.tee.id,
        });
        expect(updateTag).toHaveBeenCalledWith("home-events");
        expect(invalidatedPaths()).toEqual(
          roundChangedPaths({
            id: result.roundId,
            userId: player.id,
            tournamentId: t.tournament.id,
          }),
        );
      });

      it("refuses joining a Tournament twice", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);

        expect(
          await lifecycle.createRound(player.user.id, {
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

        expect(await lifecycle.deleteRound(a.user.id, a.round.id)).toEqual({
          ok: true,
        });

        expect(await roundRow(a.round.id)).toBeNull();
        expect(updateTag).toHaveBeenCalledWith("home-events");
        expect(invalidatedPaths()).toEqual(
          roundChangedPaths({
            id: a.round.id,
            userId: a.user.id,
            matchId: match.id,
          }),
        );
      });

      it("lets an admin delete someone else's Round", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);
        const admin = await fixtures.user({ isAdmin: true });

        expect(
          await lifecycle.deleteRound(admin.id, player.round.id),
        ).toEqual({ ok: true });
        expect(await roundRow(player.round.id)).toBeNull();
      });

      it("gives a Scorer who can't manage the Round a distinct error and keeps it", async () => {
        const { players } = await fixtures.match(2);
        const [a, b] = players;

        expect(await lifecycle.deleteRound(b.user.id, a.round.id)).toMatchObject({
          ok: false,
          error: "You can't change this Round's settings.",
        });
        expect(await roundRow(a.round.id)).not.toBeNull();
        expect(revalidatePath).not.toHaveBeenCalled();
      });

      it("reports not found to someone who can't score the Round", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);
        const stranger = await fixtures.tournamentPlayer(t);

        expect(
          await lifecycle.deleteRound(stranger.user.id, player.round.id),
        ).toMatchObject({ ok: false, error: "Round not found." });
        expect(await roundRow(player.round.id)).not.toBeNull();
      });
    });

    describe("event Round helpers", () => {
      it("inserts Tournament Rounds on the Tournament's course, tee and date", async () => {
        const t = await fixtures.tournament();
        const a = await fixtures.user();
        const b = await fixtures.user();

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
        expect(inserted.map((round) => round.userId).sort()).toEqual(
          [a.id, b.id].sort(),
        );
      });

      it("skips players who already have a Round in the event", async () => {
        const t = await fixtures.tournament();
        const existing = await fixtures.tournamentPlayer(t);
        const newcomer = await fixtures.user();

        const inserted = await db.transaction((tx) =>
          lifecycle.insertEventRounds(
            tx,
            { tournamentId: t.tournament.id },
            [existing.user.id, newcomer.id],
          ),
        );

        expect(inserted.map((round) => round.userId)).toEqual([newcomer.id]);
      });

      it("inserts Match Rounds on the Match's course and date with the given tee", async () => {
        const { match } = await fixtures.match(1);
        const white = await fixtures.tee(match.courseId);
        const player = await fixtures.user();

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
          userId: player.id,
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
            userId: round.userId,
            matchId: match.id,
          }),
        );
      });
    });
  });
}
