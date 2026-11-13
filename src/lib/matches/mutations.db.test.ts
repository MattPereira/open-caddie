import { beforeEach, describe, expect, it, vi } from "vitest";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { createRoundFixtures } from "@/lib/rounds/test-fixtures";
import * as mutations from "./mutations";

const { revalidatePath, updateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath, updateTag }));

describe("Match mutations", () => {
  const fixtures = createRoundFixtures(db, schema);

  type MatchFormat = (typeof schema.matches.$inferSelect)["format"];
  type Course = Awaited<ReturnType<typeof fixtures.course>>;

  beforeEach(() => {
    revalidatePath.mockClear();
    updateTag.mockClear();
  });

  function invalidatedPaths() {
    return (revalidatePath.mock.calls as unknown as string[][]).map((call) =>
      call.join(" "),
    );
  }

  async function players(count: number) {
    const list = [];
    for (let i = 0; i < count; i += 1) list.push(await fixtures.player());
    return list;
  }

  async function create(
    creatorId: string,
    c: Course,
    format: MatchFormat,
    playerIds: string[],
    teams: [string[], string[]] = [[], []],
  ) {
    const result = await mutations.createMatch(creatorId, {
      date: "2026-01-01",
      courseHandle: c.course.handle,
      format,
      teeId: c.tee.id,
      playerIds: playerIds,
      teamOnePlayerIds: teams[0],
      teamTwoPlayerIds: teams[1],
    });
    return result;
  }

  async function matchRounds(matchId: number) {
    return db
      .select()
      .from(schema.rounds)
      .where(eq(schema.rounds.matchId, matchId))
      .orderBy(asc(schema.rounds.id));
  }

  async function matchRow(matchId: number) {
    const [match] = await db
      .select()
      .from(schema.matches)
      .where(eq(schema.matches.id, matchId));
    return match ?? null;
  }

  // Team name → sorted Player ids.
  async function teams(matchId: number) {
    const rows = await db
      .select({ name: schema.matchTeams.name, playerId: schema.rounds.playerId })
      .from(schema.matchTeams)
      .innerJoin(
        schema.matchTeamMembers,
        eq(schema.matchTeamMembers.matchTeamId, schema.matchTeams.id),
      )
      .innerJoin(
        schema.rounds,
        eq(schema.rounds.id, schema.matchTeamMembers.roundId),
      )
      .where(eq(schema.matchTeams.matchId, matchId));
    const byName: Record<string, string[]> = {};
    for (const row of rows) (byName[row.name] ??= []).push(row.playerId);
    for (const ids of Object.values(byName)) ids.sort();
    return byName;
  }

  function updateInput(
    m: Awaited<ReturnType<typeof fixtures.match>>,
    courseHandle: string,
    teeId: number,
    overrides: Partial<Parameters<typeof mutations.updateMatch>[1]> = {},
  ) {
    return {
      id: m.match.id,
      date: "2026-01-01",
      courseHandle,
      format: m.match.format,
      teeId,
      playerIds: m.players.map((p) => p.player.id),
      teamOnePlayerIds: [],
      teamTwoPlayerIds: [],
      teamOneRoundIds: [],
      teamTwoRoundIds: [],
      ...overrides,
    };
  }

  async function courseOf(m: Awaited<ReturnType<typeof fixtures.match>>) {
    const [course] = await db
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.id, m.match.courseId));
    return course;
  }

  describe("create Match", () => {
    it("creates the Match and its Rounds on the tee, refreshing Match and Round pages", async () => {
      const c = await fixtures.course();
      const [a, b] = await players(2);

      const result = await create(a.id, c, "singles_match_play", [a.id, b.id]);

      if (!result.ok || result.id == null) throw new Error("not created");
      expect(await matchRow(result.id)).toMatchObject({
        createdByPlayerId: a.id,
        courseId: c.course.id,
        format: "singles_match_play",
      });
      const rounds = await matchRounds(result.id);
      expect(rounds.map((r) => r.playerId).sort()).toEqual([a.id, b.id].sort());
      for (const r of rounds) expect(r.teeId).toBe(c.tee.id);
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths()).toEqual(
        expect.arrayContaining([
          "/matches",
          `/matches/${result.id}`,
          `/players/${b.id}`,
          ...rounds.map((r) => `/rounds/${r.id}`),
        ]),
      );
    });

    it("creates Four-Ball teams from the chosen players", async () => {
      const c = await fixtures.course();
      const [a, b, d, e] = await players(4);

      const result = await create(
        a.id,
        c,
        "four_ball_match_play",
        [a.id, b.id, d.id, e.id],
        [
          [a.id, d.id],
          [b.id, e.id],
        ],
      );

      if (!result.ok || result.id == null) throw new Error("not created");
      expect(await teams(result.id)).toEqual({
        "Team A": [a.id, d.id].sort(),
        "Team B": [b.id, e.id].sort(),
      });
    });

    it("refuses a tee from another course", async () => {
      const c = await fixtures.course();
      const other = await fixtures.course();
      const [a, b] = await players(2);

      expect(
        await create(a.id, { ...c, tee: other.tee }, "singles_match_play", [
          a.id,
          b.id,
        ]),
      ).toEqual({
        ok: false,
        error: "Selected tee does not belong to this course.",
      });
    });
  });

  describe("update Match", () => {
    it("lets only the creator or an admin edit", async () => {
      const m = await fixtures.match(2, { creatorPlays: false });
      const course = await courseOf(m);
      const [round] = await matchRounds(m.match.id);
      const input = updateInput(m, course.handle, round.teeId, {
        date: "2026-02-01",
      });

      expect(await mutations.updateMatch(m.players[0].player.id, input)).toEqual({
        ok: false,
        error: "Only the match creator can edit this match.",
      });
      expect((await matchRow(m.match.id))?.date).toEqual(m.match.date);

      expect(await mutations.updateMatch(m.creator.id, input)).toEqual({ ok: true });
      const admin = await fixtures.player({ isAdmin: true });
      expect(
        await mutations.updateMatch(admin.id, { ...input, date: "2026-03-01" }),
      ).toEqual({ ok: true });
      expect((await matchRow(m.match.id))?.date).toEqual(
        new Date("2026-03-01T00:00:00.000Z"),
      );
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths()).toEqual(
        expect.arrayContaining(["/matches", `/matches/${m.match.id}`]),
      );
    });

    it("refuses more Rounds than Singles or Three-Ball allows", async () => {
      const m = await fixtures.match(4);
      const course = await courseOf(m);
      const [round] = await matchRounds(m.match.id);

      expect(
        await mutations.updateMatch(
          m.creator.id,
          updateInput(m, course.handle, round.teeId, {
            format: "three_ball_match_play",
          }),
        ),
      ).toEqual({
        ok: false,
        error: "Three-ball match play requires 3 or fewer player rounds.",
      });
      expect(
        await mutations.updateMatch(
          m.creator.id,
          updateInput(m, course.handle, round.teeId, {
            format: "singles_match_play",
          }),
        ),
      ).toEqual({
        ok: false,
        error: "Singles match play requires 2 or fewer player rounds.",
      });
      expect((await matchRow(m.match.id))?.format).toBe("singles_match_play");
    });

    it("reassigns Four-Ball teams by Round", async () => {
      const c = await fixtures.course();
      const [a, b, d, e] = await players(4);
      const created = await create(
        a.id,
        c,
        "four_ball_match_play",
        [a.id, b.id, d.id, e.id],
        [
          [a.id, b.id],
          [d.id, e.id],
        ],
      );
      if (!created.ok || created.id == null) throw new Error("not created");
      const roundIdByPlayer = new Map(
        (await matchRounds(created.id)).map((r) => [r.playerId, r.id]),
      );

      const result = await mutations.updateMatch(a.id, {
        id: created.id,
        date: "2026-01-01",
        courseHandle: c.course.handle,
        format: "four_ball_match_play",
        teeId: c.tee.id,
        playerIds: [a.id, b.id, d.id, e.id],
        teamOnePlayerIds: [],
        teamTwoPlayerIds: [],
        teamOneRoundIds: [roundIdByPlayer.get(a.id)!, roundIdByPlayer.get(e.id)!],
        teamTwoRoundIds: [roundIdByPlayer.get(b.id)!, roundIdByPlayer.get(d.id)!],
      });

      expect(result).toEqual({ ok: true });
      expect(await teams(created.id)).toEqual({
        "Team A": [a.id, e.id].sort(),
        "Team B": [b.id, d.id].sort(),
      });
    });

    it("refills a short Four-Ball roster with Rounds for the missing players", async () => {
      const m = await fixtures.match(3);
      const course = await courseOf(m);
      const [round] = await matchRounds(m.match.id);
      const fourth = await fixtures.player();
      const [a, b, d] = m.players.map((p) => p.player.id);

      const result = await mutations.updateMatch(
        m.creator.id,
        updateInput(m, course.handle, round.teeId, {
          format: "four_ball_match_play",
          playerIds: [a, b, d, fourth.id],
          teamOnePlayerIds: [a, fourth.id],
          teamTwoPlayerIds: [b, d],
        }),
      );

      expect(result).toEqual({ ok: true });
      const rounds = await matchRounds(m.match.id);
      expect(rounds).toHaveLength(4);
      expect(rounds.find((r) => r.playerId === fourth.id)?.teeId).toBe(
        round.teeId,
      );
      expect(await teams(m.match.id)).toEqual({
        "Team A": [a, fourth.id].sort(),
        "Team B": [b, d].sort(),
      });
      expect(invalidatedPaths()).toContain(`/players/${fourth.id}`);
    });

    it("refuses a refill that drops a current player", async () => {
      const m = await fixtures.match(3);
      const course = await courseOf(m);
      const [round] = await matchRounds(m.match.id);
      const [x, y] = await players(2);
      const [a, b] = m.players.map((p) => p.player.id);

      expect(
        await mutations.updateMatch(
          m.creator.id,
          updateInput(m, course.handle, round.teeId, {
            format: "four_ball_match_play",
            playerIds: [a, b, x.id, y.id],
            teamOnePlayerIds: [a, x.id],
            teamTwoPlayerIds: [b, y.id],
          }),
        ),
      ).toEqual({
        ok: false,
        error: "Four-ball match play requires 4 rounds split into 2 teams.",
      });
      expect(await matchRounds(m.match.id)).toHaveLength(3);
    });

    it("drops Four-Ball teams when the format changes away", async () => {
      const c = await fixtures.course();
      const [a, b, d, e] = await players(4);
      const created = await create(
        a.id,
        c,
        "four_ball_match_play",
        [a.id, b.id, d.id, e.id],
        [
          [a.id, b.id],
          [d.id, e.id],
        ],
      );
      if (!created.ok || created.id == null) throw new Error("not created");
      const eRound = (await matchRounds(created.id)).find(
        (r) => r.playerId === e.id,
      )!;
      await db.delete(schema.rounds).where(eq(schema.rounds.id, eRound.id));

      const result = await mutations.updateMatch(a.id, {
        id: created.id,
        date: "2026-01-01",
        courseHandle: c.course.handle,
        format: "three_ball_match_play",
        teeId: c.tee.id,
        playerIds: [a.id, b.id, d.id],
        teamOnePlayerIds: [],
        teamTwoPlayerIds: [],
        teamOneRoundIds: [],
        teamTwoRoundIds: [],
      });

      expect(result).toEqual({ ok: true });
      expect(await teams(created.id)).toEqual({});
      expect((await matchRow(created.id))?.format).toBe(
        "three_ball_match_play",
      );
    });

    it("refuses a course change once a Round has scores, changing nothing", async () => {
      const m = await fixtures.match(2);
      await db
        .insert(schema.roundScores)
        .values({ roundId: m.players[0].round.id, hole: 1, strokes: 4 });
      const next = await fixtures.course();

      const result = await mutations.updateMatch(
        m.creator.id,
        updateInput(m, next.course.handle, next.tee.id),
      );

      expect(result).toMatchObject({ ok: false });
      expect(!result.ok && result.error).toMatch(/Can't change the course/);
      expect((await matchRow(m.match.id))?.courseId).toBe(m.match.courseId);
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("delete Match", () => {
    it("refuses anyone but the creator or an admin", async () => {
      const m = await fixtures.match(2, { creatorPlays: false });

      expect(
        await mutations.deleteMatch(m.players[0].player.id, m.match.id),
      ).toEqual({
        ok: false,
        error: "Only the match creator can edit this match.",
      });
      expect(await matchRow(m.match.id)).not.toBeNull();
    });

    it("deletes the Match and its Rounds, refreshing Match and Round pages", async () => {
      const m = await fixtures.match(2);

      expect(await mutations.deleteMatch(m.creator.id, m.match.id)).toEqual({
        ok: true,
      });

      expect(await matchRow(m.match.id)).toBeNull();
      expect(await matchRounds(m.match.id)).toHaveLength(0);
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths()).toEqual(
        expect.arrayContaining([
          "/matches",
          `/matches/${m.match.id}`,
          ...m.players.map((p) => `/rounds/${p.round.id}`),
        ]),
      );
    });
  });
});
