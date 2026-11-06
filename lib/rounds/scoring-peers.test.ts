import { afterEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe.skip("Scoring peers", () => {
    it("requires TEST_DATABASE_URL", () => {});
  });
} else {
  // The play page asks this for the Rounds the access read says the viewer may
  // score, so the cases are what its columns need: whose card, what's on it.
  describe("Scoring peers", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.DATABASE_DRIVER = "node-postgres";
    const [{ db }, schema, { getScoringPeers }, { createRoundFixtures, PAR_THREE_HOLES }] =
      await Promise.all([
        import("@/db"),
        import("@/db/schema"),
        import("./queries"),
        import("./test-fixtures"),
      ]);
    const fixtures = createRoundFixtures(db, schema);

    const PAR_THREE = PAR_THREE_HOLES[0];
    const PAR_FOUR = 1;

    afterEach(async () => {
      await fixtures.cleanup();
    });

    it("returns each Round's player in the order asked", async () => {
      const { players } = await fixtures.match(3);
      const [first, second, third] = players;

      const peers = await getScoringPeers([third.round.id, first.round.id]);

      expect(peers).toMatchObject([
        { roundId: third.round.id, userId: third.user.id, lastName: third.user.lastName },
        { roundId: first.round.id, userId: first.user.id, lastName: first.user.lastName },
      ]);
      expect(peers.map((peer) => peer.roundId)).not.toContain(second.round.id);
    });

    it("carries each Round's per-hole scores and Greenies", async () => {
      const { players } = await fixtures.match(2);
      const peer = players[1];
      await db.insert(schema.roundScores).values([
        { roundId: peer.round.id, hole: PAR_FOUR, strokes: 5, putts: 2 },
        { roundId: peer.round.id, hole: PAR_THREE, strokes: 3, putts: 1 },
      ]);
      await db
        .insert(schema.greenies)
        .values({ roundId: peer.round.id, hole: PAR_THREE, feet: 12, inches: 6 });

      expect(await getScoringPeers([peer.round.id])).toMatchObject([
        {
          roundId: peer.round.id,
          scores: [
            { hole: PAR_FOUR, par: 4, strokes: 5, putts: 2 },
            { hole: PAR_THREE, par: 3, strokes: 3, putts: 1 },
          ],
          greenies: [{ hole: PAR_THREE, feet: 12, inches: 6 }],
        },
      ]);
    });

    it("returns nothing when asked for no Rounds", async () => {
      expect(await getScoringPeers([])).toEqual([]);
    });
  });
}
