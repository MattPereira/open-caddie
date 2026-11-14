import { describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { createRoundFixtures } from "@/lib/rounds/test-fixtures";
import * as queries from "./queries";

describe("Tournament queries", () => {
  const fixtures = createRoundFixtures(db, schema);

  type Tournament = Awaited<ReturnType<typeof fixtures.tournament>>;

  // Fixture tees are rated 72, so with their slope a Round's Score
  // Differential scales back to (strokes - 72) as a Course Handicap.
  async function card(roundId: number, totalStrokes: number) {
    await db.insert(schema.roundScores).values(
      Array.from({ length: 18 }, (_, index) => ({
        roundId,
        hole: index + 1,
        strokes: index === 17 ? totalStrokes - 68 : 4,
        putts: 2,
      })),
    );
  }

  // A complete Round for `playerId` in another Tournament of the same Club.
  async function priorRound(
    t: Tournament,
    playerId: string,
    date: string,
    totalStrokes: number,
  ) {
    const [other] = await db
      .insert(schema.tournaments)
      .values({
        seasonId: t.tournament.seasonId,
        date: new Date(`${date}T00:00:00.000Z`),
        courseId: t.course.id,
        teeId: t.tee.id,
      })
      .returning();
    const [round] = await db
      .insert(schema.rounds)
      .values({
        tournamentId: other.id,
        playerId,
        courseId: t.course.id,
        teeId: t.tee.id,
        date: other.date,
      })
      .returning();
    await card(round.id, totalStrokes);
  }

  it("ranks a Tournament's Rounds by net, then gross, then name, with no net strokes last", async () => {
    const t = await fixtures.tournament();
    const players = [];
    for (const lastName of ["Incomplete", "Bravo", "Alpha", "Handicap", "Low"]) {
      const player = await fixtures.tournamentPlayer(t);
      await db
        .update(schema.users)
        .set({ lastName })
        .where(eq(schema.users.id, player.player.id));
      players.push(player);
    }
    const [incomplete, bravo, alpha, handicap, low] = players;
    await db
      .insert(schema.roundScores)
      .values({ roundId: incomplete.round.id, hole: 1, strokes: 3 });
    await card(bravo.round.id, 77);
    await card(alpha.round.id, 77);
    // Net 75 off gross 80 ranks behind a scratch 75.
    await priorRound(t, handicap.player.id, "2025-02-01", 76);
    await priorRound(t, handicap.player.id, "2025-03-01", 78);
    await card(handicap.round.id, 80);
    await card(low.round.id, 75);

    const tournament = await queries.getTournamentById(t.tournament.id);

    expect(tournament?.rounds.map((round) => round.lastName)).toEqual([
      "Low",
      "Handicap",
      "Alpha",
      "Bravo",
      "Incomplete",
    ]);
  });
});
