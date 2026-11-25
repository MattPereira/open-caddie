import { revalidatePath, updateTag } from "next/cache";
import { describe, expect, it } from "vitest";

import { required } from "@/lib/required";
import * as matches from "@/modules/matches/server";
import { deleteRound, getMatchRounds } from "@/modules/rounds/server";
import { createFixtures } from "@/test/fixtures";
import { invalidatedPaths, roundChangedPaths } from "@/test/round-changed";

describe("Match mutations", () => {
  const fixtures = createFixtures();

  type MatchFormat = matches.MatchCreateInput["format"];
  type Course = Awaited<ReturnType<typeof fixtures.course>>;

  function matchChanged(matchId: number) {
    return ["/matches", `/matches/${matchId}`];
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
    const result = await matches.createMatch(creatorId, {
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
    const { rounds } = await getMatchRounds(matchId);
    return rounds.toSorted((a, b) => a.id - b.id);
  }

  async function matchRow(matchId: number) {
    return (await matches.getMatchById(matchId)) ?? null;
  }

  // Team name → sorted Player ids.
  async function teams(matchId: number) {
    const match = required(await matches.getMatchById(matchId), "match");
    return Object.fromEntries(
      match.teams.map((team) => [
        team.name,
        team.rounds.map((round) => round.playerId).sort(),
      ]),
    );
  }

  function updateInput(
    m: Awaited<ReturnType<typeof fixtures.match>>,
    courseHandle: string,
    teeId: number,
    overrides: Partial<Parameters<typeof matches.updateMatch>[1]> = {},
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
      expect(invalidatedPaths(revalidatePath)).toEqual(
        [...matchChanged(result.id), ...roundChangedPaths(...rounds)].sort(),
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
      const [round] = await matchRounds(m.match.id);
      const input = updateInput(m, m.match.courseHandle, round.teeId, {
        date: "2026-02-01",
      });

      expect(await matches.updateMatch(m.players[0].player.id, input)).toEqual({
        ok: false,
        error: "Only the match creator can edit this match.",
      });
      expect((await matchRow(m.match.id))?.date).toEqual(m.match.date);

      expect(await matches.updateMatch(m.creator.id, input)).toEqual({
        ok: true,
      });
      const admin = await fixtures.player({ isPlatformAdmin: true });
      expect(
        await matches.updateMatch(admin.id, { ...input, date: "2026-03-01" }),
      ).toEqual({ ok: true });
      expect((await matchRow(m.match.id))?.date).toEqual(
        new Date("2026-03-01T00:00:00.000Z"),
      );
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths(revalidatePath)).toEqual(
        [
          ...matchChanged(m.match.id),
          ...roundChangedPaths(...(await matchRounds(m.match.id))),
        ].sort(),
      );
    });

    it("refuses more Rounds than Singles or Three-Ball allows", async () => {
      const m = await fixtures.match(4);
      const [round] = await matchRounds(m.match.id);

      expect(
        await matches.updateMatch(
          m.creator.id,
          updateInput(m, m.match.courseHandle, round.teeId, {
            format: "three_ball_match_play",
          }),
        ),
      ).toEqual({
        ok: false,
        error: "Three-ball match play requires 3 or fewer player rounds.",
      });
      expect(
        await matches.updateMatch(
          m.creator.id,
          updateInput(m, m.match.courseHandle, round.teeId, {
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

      const result = await matches.updateMatch(a.id, {
        id: created.id,
        date: "2026-01-01",
        courseHandle: c.course.handle,
        format: "four_ball_match_play",
        teeId: c.tee.id,
        playerIds: [a.id, b.id, d.id, e.id],
        teamOnePlayerIds: [],
        teamTwoPlayerIds: [],
        teamOneRoundIds: [
          required(roundIdByPlayer.get(a.id), "a Round"),
          required(roundIdByPlayer.get(e.id), "e Round"),
        ],
        teamTwoRoundIds: [
          required(roundIdByPlayer.get(b.id), "b Round"),
          required(roundIdByPlayer.get(d.id), "d Round"),
        ],
      });

      expect(result).toEqual({ ok: true });
      expect(await teams(created.id)).toEqual({
        "Team A": [a.id, e.id].sort(),
        "Team B": [b.id, d.id].sort(),
      });
    });

    it("refills a short Four-Ball roster with Rounds for the missing players", async () => {
      const m = await fixtures.match(3);
      const [round] = await matchRounds(m.match.id);
      const fourth = await fixtures.player();
      const [a, b, d] = m.players.map((p) => p.player.id);

      const result = await matches.updateMatch(
        m.creator.id,
        updateInput(m, m.match.courseHandle, round.teeId, {
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
      const added = rounds.filter((r) => r.playerId === fourth.id);
      expect(invalidatedPaths(revalidatePath)).toEqual(
        [...matchChanged(m.match.id), ...roundChangedPaths(...added)].sort(),
      );
    });

    it("refuses a refill that drops a current player", async () => {
      const m = await fixtures.match(3);
      const [round] = await matchRounds(m.match.id);
      const [x, y] = await players(2);
      const [a, b] = m.players.map((p) => p.player.id);

      expect(
        await matches.updateMatch(
          m.creator.id,
          updateInput(m, m.match.courseHandle, round.teeId, {
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
      const eRound = required(
        (await matchRounds(created.id)).find((r) => r.playerId === e.id),
        "e Round",
      );
      expect(await deleteRound(e.id, eRound.id)).toEqual({ ok: true });

      const result = await matches.updateMatch(a.id, {
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
      await fixtures.scores(m.players[0].round.id, [{ hole: 1, strokes: 4 }]);
      const next = await fixtures.course();

      const result = await matches.updateMatch(
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
        await matches.deleteMatch(m.players[0].player.id, m.match.id),
      ).toEqual({
        ok: false,
        error: "Only the match creator can edit this match.",
      });
      expect(await matchRow(m.match.id)).not.toBeNull();
    });

    it("deletes the Match and its Rounds, refreshing Match and Round pages", async () => {
      const m = await fixtures.match(2);

      expect(await matches.deleteMatch(m.creator.id, m.match.id)).toEqual({
        ok: true,
      });

      expect(await matchRow(m.match.id)).toBeNull();
      expect(await matchRounds(m.match.id)).toHaveLength(0);
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(invalidatedPaths(revalidatePath)).toEqual(
        [
          ...matchChanged(m.match.id),
          ...roundChangedPaths(...m.players.map((p) => p.round)),
        ].sort(),
      );
    });
  });
});
