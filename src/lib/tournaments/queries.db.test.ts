import { describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { createRoundFixtures } from "@/lib/rounds/test-fixtures";
import * as queries from "./queries";

describe("Tournament queries", () => {
  const fixtures = createRoundFixtures(db, schema);

  async function card(roundId: number, totalStrokes: number) {
    await db.insert(schema.roundScores).values(
      Array.from({ length: 18 }, (_, index) => ({
        roundId,
        hole: index + 1,
        strokes: index === 17 ? totalStrokes - 68 : 4,
      })),
    );
  }

  // Full ranking rules are unit tested in results.test.ts; this proves the read applies them.
  it("returns a Tournament's Rounds in Tournament Ranking order, not name order", async () => {
    const t = await fixtures.tournament();
    const players = [];
    for (const lastName of ["Aardvark", "Bravo", "Charlie"]) {
      const player = await fixtures.tournamentPlayer(t);
      await db
        .update(schema.users)
        .set({ lastName })
        .where(eq(schema.users.id, player.player.id));
      players.push(player);
    }
    const [incomplete, bravo, charlie] = players;
    await db
      .insert(schema.roundScores)
      .values({ roundId: incomplete.round.id, hole: 1, strokes: 3 });
    await card(bravo.round.id, 80);
    await card(charlie.round.id, 75);

    const tournament = await queries.getTournamentById(t.tournament.id);

    expect(tournament?.rounds.map((round) => round.lastName)).toEqual([
      "Charlie",
      "Bravo",
      "Aardvark",
    ]);
  });
});
