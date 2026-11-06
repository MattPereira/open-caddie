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

  describe("Event Round access", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.DATABASE_DRIVER = "node-postgres";
    const [{ db }, schema, { getEventRoundAccess }, { createRoundFixtures }] =
      await Promise.all([
        import("@/db"),
        import("@/db/schema"),
        import("./access"),
        import("./test-fixtures"),
      ]);
    const fixtures = createRoundFixtures(db, schema);

    function sorted(ids: number[]) {
      return [...ids].sort((a, b) => a - b);
    }

    async function eventAccessOf(
      viewerUserId: string,
      event: { kind: "tournament" | "match"; id: number },
    ) {
      const access = await getEventRoundAccess(viewerUserId, event);
      return {
        scorable: sorted(access.scorableRoundIds),
        manageable: sorted(access.manageableRoundIds),
        canImportScorecard: access.canImportScorecard,
      };
    }

    afterEach(async () => {
      await fixtures.cleanup();
    });

    it("lets a Pairing mate score and import their Pairing's Rounds only", async () => {
      const t = await fixtures.tournament();
      const marker = await fixtures.tournamentPlayer(t);
      const mate = await fixtures.tournamentPlayer(t);
      const other = await fixtures.tournamentPlayer(t);
      await fixtures.pairing(t.tournament.id, [marker.round.id, mate.round.id]);
      await fixtures.pairing(t.tournament.id, [other.round.id]);

      expect(
        await eventAccessOf(marker.user.id, {
          kind: "tournament",
          id: t.tournament.id,
        }),
      ).toEqual({
        scorable: sorted([marker.round.id, mate.round.id]),
        manageable: [marker.round.id],
        canImportScorecard: true,
      });
    });

    it("leaves a Tournament player in no Pairing their own Round and no import", async () => {
      const t = await fixtures.tournament();
      const ungrouped = await fixtures.tournamentPlayer(t);
      const paired = await fixtures.tournamentPlayer(t);
      await fixtures.pairing(t.tournament.id, [paired.round.id]);

      expect(
        await eventAccessOf(ungrouped.user.id, {
          kind: "tournament",
          id: t.tournament.id,
        }),
      ).toEqual({
        scorable: [ungrouped.round.id],
        manageable: [ungrouped.round.id],
        canImportScorecard: false,
      });
    });

    it("lets an admin score, manage and import every Round in the event", async () => {
      const t = await fixtures.tournament();
      const first = await fixtures.tournamentPlayer(t);
      const second = await fixtures.tournamentPlayer(t);
      const admin = await fixtures.user({ isAdmin: true });
      const all = sorted([first.round.id, second.round.id]);

      expect(
        await eventAccessOf(admin.id, {
          kind: "tournament",
          id: t.tournament.id,
        }),
      ).toEqual({ scorable: all, manageable: all, canImportScorecard: true });
    });

    it("lets a Match player score and import every Match Round, managing only their own", async () => {
      const { match, players } = await fixtures.match(2);
      const [self, peer] = players;

      expect(
        await eventAccessOf(self.user.id, { kind: "match", id: match.id }),
      ).toEqual({
        scorable: sorted([self.round.id, peer.round.id]),
        manageable: [self.round.id],
        canImportScorecard: true,
      });
    });

    it("lets a Match creator who isn't playing score and import every Match Round", async () => {
      const { match, creator, players } = await fixtures.match(2, {
        creatorPlays: false,
      });

      expect(
        await eventAccessOf(creator.id, { kind: "match", id: match.id }),
      ).toEqual({
        scorable: sorted(players.map((player) => player.round.id)),
        manageable: [],
        canImportScorecard: true,
      });
    });

    it("gives a non-member of a Match nothing", async () => {
      const { match } = await fixtures.match(2);
      const stranger = await fixtures.user();

      expect(
        await eventAccessOf(stranger.id, { kind: "match", id: match.id }),
      ).toEqual({ scorable: [], manageable: [], canImportScorecard: false });
    });
  });
}
