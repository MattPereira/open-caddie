import { afterEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe.skip("Round access", () => {
    it("requires TEST_DATABASE_URL", () => {});
  });
} else {
  describe("Round access", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.DATABASE_DRIVER = "node-postgres";
    const [{ db }, schema, { getRoundAccess }, { createRoundFixtures }] =
      await Promise.all([
        import("@/db"),
        import("@/db/schema"),
        import("./access"),
        import("./test-fixtures"),
      ]);
    const fixtures = createRoundFixtures(db, schema);

    const NO_ACCESS = { canScore: false, canManage: false, peers: [] };

    function sorted(ids: number[]) {
      return [...ids].sort((a, b) => a - b);
    }

    // Peer order is by player name, which these fixtures randomise, so
    // compare peers as a set.
    async function accessOf(viewerUserId: string, roundId: number) {
      const access = await getRoundAccess(viewerUserId, roundId);
      if (!access) throw new Error("Round not found");
      return {
        canScore: access.canScore,
        canManage: access.canManage,
        peers: sorted(access.scorablePeerRoundIds),
      };
    }

    afterEach(async () => {
      await fixtures.cleanup();
    });

    it("lets the Round's player score and manage, with their Pairing mates as peers", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const mate = await fixtures.tournamentPlayer(t);
      await fixtures.pairing(t.tournament.id, [player.round.id, mate.round.id]);

      expect(
        await getRoundAccess(player.user.id, player.round.id),
      ).toMatchObject({
        canScore: true,
        canManage: true,
        scorablePeerRoundIds: [mate.round.id],
      });
    });

    it("lets an admin score and manage any Round, with its whole Pairing as peers", async () => {
      const t = await fixtures.tournament();
      const target = await fixtures.tournamentPlayer(t);
      const mate = await fixtures.tournamentPlayer(t);
      await fixtures.pairing(t.tournament.id, [target.round.id, mate.round.id]);
      const admin = await fixtures.user({ isAdmin: true });

      expect(await accessOf(admin.id, target.round.id)).toEqual({
        canScore: true,
        canManage: true,
        peers: [mate.round.id],
      });
    });

    it("lets a Pairing mate score but not manage, with the rest of the Pairing as peers", async () => {
      const t = await fixtures.tournament();
      const marker = await fixtures.tournamentPlayer(t);
      const target = await fixtures.tournamentPlayer(t);
      const third = await fixtures.tournamentPlayer(t);
      await fixtures.pairing(t.tournament.id, [
        marker.round.id,
        target.round.id,
        third.round.id,
      ]);

      expect(await accessOf(marker.user.id, target.round.id)).toEqual({
        canScore: true,
        canManage: false,
        peers: sorted([marker.round.id, third.round.id]),
      });
    });

    it("gives a player in another Pairing no access", async () => {
      const t = await fixtures.tournament();
      const outsider = await fixtures.tournamentPlayer(t);
      const target = await fixtures.tournamentPlayer(t);
      const mate = await fixtures.tournamentPlayer(t);
      await fixtures.pairing(t.tournament.id, [outsider.round.id]);
      await fixtures.pairing(t.tournament.id, [target.round.id, mate.round.id]);

      expect(await accessOf(outsider.user.id, target.round.id)).toEqual(
        NO_ACCESS,
      );
    });

    it("gives a Tournament player in no Pairing no access to a paired Round", async () => {
      const t = await fixtures.tournament();
      const ungrouped = await fixtures.tournamentPlayer(t);
      const target = await fixtures.tournamentPlayer(t);
      await fixtures.pairing(t.tournament.id, [target.round.id]);

      expect(await accessOf(ungrouped.user.id, target.round.id)).toEqual(
        NO_ACCESS,
      );
    });

    it("leaves a player in no Pairing scoring and managing only their own Round", async () => {
      const t = await fixtures.tournament();
      const ungrouped = await fixtures.tournamentPlayer(t);
      const paired = await fixtures.tournamentPlayer(t);
      await fixtures.pairing(t.tournament.id, [paired.round.id]);

      expect(await accessOf(ungrouped.user.id, ungrouped.round.id)).toEqual({
        canScore: true,
        canManage: true,
        peers: [],
      });
    });

    it("grants no peer access in a Tournament with no Pairings", async () => {
      const t = await fixtures.tournament();
      const peer = await fixtures.tournamentPlayer(t);
      const target = await fixtures.tournamentPlayer(t);

      expect(await accessOf(peer.user.id, target.round.id)).toEqual(NO_ACCESS);
      expect(await accessOf(target.user.id, target.round.id)).toEqual({
        canScore: true,
        canManage: true,
        peers: [],
      });
    });

    it("lets a Match peer score but not manage, with the other Match Rounds as peers", async () => {
      const { players } = await fixtures.match(3);
      const [marker, target, third] = players;

      expect(await accessOf(marker.user.id, target.round.id)).toEqual({
        canScore: true,
        canManage: false,
        peers: sorted([marker.round.id, third.round.id]),
      });
    });

    it("lets a Match creator who isn't playing score every Match Round but manage none", async () => {
      const { creator, players } = await fixtures.match(2, {
        creatorPlays: false,
      });
      const [target, other] = players;

      expect(await accessOf(creator.id, target.round.id)).toEqual({
        canScore: true,
        canManage: false,
        peers: [other.round.id],
      });
    });

    it("gives a non-member of a Match no access", async () => {
      const { players } = await fixtures.match(2);
      const stranger = await fixtures.user();

      expect(await accessOf(stranger.id, players[1].round.id)).toEqual(
        NO_ACCESS,
      );
    });

    it("returns null for a Round that doesn't exist", async () => {
      const viewer = await fixtures.user();

      expect(await getRoundAccess(viewer.id, 2_147_483_000)).toBeNull();
    });
  });
}
