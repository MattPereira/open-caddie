import { revalidatePath, updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRoundById } from "@/modules/rounds/server";
import * as tournaments from "@/modules/tournaments/server";
import { PAIRING_MAX_MEMBERS } from "@/modules/tournaments";
import { clearCacheMocks } from "@/test/cache-mocks";
import { warmConnections } from "@/test/db/seed";
import { createFixtures } from "@/test/fixtures";

describe("Pairing writes", () => {
  const fixtures = createFixtures();
  const tournamentFixture = () => fixtures.tournament();
  // A Tournament Player: a Player with a Round in that Tournament, which is
  // what a Pairing actually holds.
  const playerFixture = (f: Awaited<ReturnType<typeof tournamentFixture>>) =>
    fixtures.tournamentPlayer(f);

  let adminId: string;

  async function createPairing(tournamentId: number) {
    const result = await tournaments.createPairing(adminId, { tournamentId });
    if (!result.ok || result.id == null)
      throw new Error(result.ok ? "Missing Pairing id" : result.error);
    return result.id;
  }

  async function newPlayerId(isAdmin = false) {
    return (await fixtures.player({ isAdmin })).id;
  }

  beforeEach(async () => {
    adminId = await fixtures.admin();
  });

  it("creates a numbered Pairing for an admin", async () => {
    const { tournament } = await tournamentFixture();
    const id = await createPairing(tournament.id);

    expect(
      await tournaments.getPairingsForTournament(tournament.id),
    ).toMatchObject([{ id, name: "Pairing 1", members: [] }]);
  });

  it("rejects every Pairing mutation from a non-admin", async () => {
    const { tournament } = await tournamentFixture();
    const pairingId = await createPairing(tournament.id);
    const nonAdminId = await newPlayerId();

    expect(
      await tournaments.createPairing(nonAdminId, {
        tournamentId: tournament.id,
      }),
    ).toEqual({ ok: false, error: "Only admins can manage Pairings." });
    expect(
      await tournaments.renamePairing(nonAdminId, {
        pairingId,
        name: "Late tee",
      }),
    ).toEqual({ ok: false, error: "Only admins can manage Pairings." });
    expect(await tournaments.deletePairing(nonAdminId, { pairingId })).toEqual({
      ok: false,
      error: "Only admins can manage Pairings.",
    });
    expect(
      await tournaments.getPairingsForTournament(tournament.id),
    ).toMatchObject([{ id: pairingId, name: "Pairing 1" }]);
  });

  it("names each new Pairing by number without reusing a deleted number", async () => {
    const { tournament } = await tournamentFixture();
    const first = await createPairing(tournament.id);
    await createPairing(tournament.id);
    expect(
      (await tournaments.getPairingsForTournament(tournament.id)).map(
        ({ name }) => name,
      ),
    ).toEqual(["Pairing 1", "Pairing 2"]);

    expect(
      await tournaments.deletePairing(adminId, { pairingId: first }),
    ).toMatchObject({ ok: true });
    await createPairing(tournament.id);
    expect(
      (await tournaments.getPairingsForTournament(tournament.id)).map(
        ({ name }) => name,
      ),
    ).toEqual(["Pairing 2", "Pairing 3"]);
  });

  it("frees the last number again once its Pairing is deleted", async () => {
    const { tournament } = await tournamentFixture();
    await createPairing(tournament.id);
    const second = await createPairing(tournament.id);

    expect(
      await tournaments.deletePairing(adminId, { pairingId: second }),
    ).toMatchObject({ ok: true });
    await createPairing(tournament.id);
    expect(
      (await tournaments.getPairingsForTournament(tournament.id)).map(
        ({ name }) => name,
      ),
    ).toEqual(["Pairing 1", "Pairing 2"]);
  });

  it("lists a Tournament's Pairings in the order they were created", async () => {
    const { tournament } = await tournamentFixture();
    const first = await createPairing(tournament.id);
    const second = await createPairing(tournament.id);
    const third = await createPairing(tournament.id);

    expect(
      (await tournaments.getPairingsForTournament(tournament.id)).map(
        ({ id }) => id,
      ),
    ).toEqual([first, second, third]);
  });

  it("numbers Pairings per Tournament", async () => {
    const { tournament: first } = await tournamentFixture();
    const { tournament: second } = await tournamentFixture();
    await createPairing(first.id);
    await createPairing(second.id);
    expect(
      (await tournaments.getPairingsForTournament(second.id)).map(
        ({ name }) => name,
      ),
    ).toEqual(["Pairing 1"]);
  });

  it("renames a Pairing", async () => {
    const { tournament } = await tournamentFixture();
    const pairingId = await createPairing(tournament.id);

    expect(
      await tournaments.renamePairing(adminId, {
        pairingId,
        name: "  8:30 tee  ",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await tournaments.getPairingsForTournament(tournament.id),
    ).toMatchObject([{ id: pairingId, name: "8:30 tee" }]);
    expect(
      await tournaments.renamePairing(adminId, { pairingId, name: "   " }),
    ).toEqual({ ok: false, error: "Name is required" });
    expect(
      await tournaments.renamePairing(adminId, {
        pairingId,
        name: "x".repeat(61),
      }),
    ).toEqual({ ok: false, error: "Name is too long" });
  });

  it("deletes a Pairing and leaves the Tournament's other Pairings ordered", async () => {
    const { tournament } = await tournamentFixture();
    const first = await createPairing(tournament.id);
    const second = await createPairing(tournament.id);

    expect(
      await tournaments.deletePairing(adminId, { pairingId: first }),
    ).toMatchObject({ ok: true });
    expect(
      await tournaments.getPairingsForTournament(tournament.id),
    ).toMatchObject([{ id: second, name: "Pairing 2" }]);
    expect(await tournaments.getTournamentById(tournament.id)).toMatchObject({
      id: tournament.id,
    });
  });

  it("assigns an unassigned Round to a Pairing", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const { player, round } = await playerFixture(f);
    expect(
      await tournaments.getUnassignedRoundsForTournament(f.tournament.id),
    ).toMatchObject([{ roundId: round.id, playerId: player.id }]);

    expect(
      await tournaments.assignRoundToPairing(adminId, {
        pairingId,
        roundId: round.id,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await tournaments.getPairingsForTournament(f.tournament.id),
    ).toMatchObject([
      { id: pairingId, members: [{ roundId: round.id, playerId: player.id }] },
    ]);
    expect(
      await tournaments.getUnassignedRoundsForTournament(f.tournament.id),
    ).toEqual([]);
  });

  it("moves a Round from one Pairing to another", async () => {
    const f = await tournamentFixture();
    const first = await createPairing(f.tournament.id);
    const second = await createPairing(f.tournament.id);
    const { round } = await playerFixture(f);
    await tournaments.assignRoundToPairing(adminId, {
      pairingId: first,
      roundId: round.id,
    });

    expect(
      await tournaments.assignRoundToPairing(adminId, {
        pairingId: second,
        roundId: round.id,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await tournaments.getPairingsForTournament(f.tournament.id),
    ).toMatchObject([
      { id: first, members: [] },
      { id: second, members: [{ roundId: round.id }] },
    ]);
  });

  it("removes a Round from its Pairing without removing the player from the Tournament", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const { round } = await playerFixture(f);
    await tournaments.assignRoundToPairing(adminId, {
      pairingId,
      roundId: round.id,
    });

    expect(
      await tournaments.removeRoundFromPairing(adminId, { roundId: round.id }),
    ).toMatchObject({ ok: true });
    expect(
      await tournaments.getPairingsForTournament(f.tournament.id),
    ).toMatchObject([{ id: pairingId, members: [] }]);
    expect(
      await tournaments.getUnassignedRoundsForTournament(f.tournament.id),
    ).toMatchObject([{ roundId: round.id }]);
    expect(await getRoundById(round.id)).toMatchObject({
      tournamentId: f.tournament.id,
    });
  });

  it("leaves a player added after grouping unassigned", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const early = await playerFixture(f);
    await tournaments.assignRoundToPairing(adminId, {
      pairingId,
      roundId: early.round.id,
    });

    const late = await playerFixture(f);
    expect(
      await tournaments.getUnassignedRoundsForTournament(f.tournament.id),
    ).toMatchObject([{ roundId: late.round.id }]);
    expect(
      await tournaments.getPairingsForTournament(f.tournament.id),
    ).toMatchObject([{ members: [{ roundId: early.round.id }] }]);
  });

  it("rejects a fifth Round with a message", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const field = [];
    for (let i = 0; i < 5; i += 1) field.push((await playerFixture(f)).round);
    for (const round of field.slice(0, 4)) {
      expect(
        await tournaments.assignRoundToPairing(adminId, {
          pairingId,
          roundId: round.id,
        }),
      ).toMatchObject({ ok: true });
    }

    const fifth = await tournaments.assignRoundToPairing(adminId, {
      pairingId,
      roundId: field[4].id,
    });
    expect(fifth).toMatchObject({
      ok: false,
      error: expect.stringContaining("4"),
    });
    expect(
      await tournaments.getUnassignedRoundsForTournament(f.tournament.id),
    ).toMatchObject([{ roundId: field[4].id }]);
  });

  it("admits only one of two simultaneous assignments to the last place", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const field = [];
    for (let i = 0; i < 5; i += 1) field.push((await playerFixture(f)).round);
    for (const round of field.slice(0, 3)) {
      await tournaments.assignRoundToPairing(adminId, {
        pairingId,
        roundId: round.id,
      });
    }

    await warmConnections(2);
    const results = await Promise.all(
      field.slice(3).map((round) =>
        tournaments.assignRoundToPairing(adminId, {
          pairingId,
          roundId: round.id,
        }),
      ),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, error: "A Pairing holds at most 4 players." },
    ]);
    const [pairing] = await tournaments.getPairingsForTournament(
      f.tournament.id,
    );
    expect(pairing.members).toHaveLength(PAIRING_MAX_MEMBERS);
    const unassigned = await tournaments.getUnassignedRoundsForTournament(
      f.tournament.id,
    );
    expect(unassigned).toHaveLength(1);
    expect(field.slice(3).map((round) => round.id)).toContain(
      unassigned[0].roundId,
    );
    // Reassigning an existing member still succeeds when the Pairing is full.
    expect(
      await tournaments.assignRoundToPairing(adminId, {
        pairingId,
        roundId: field[0].id,
      }),
    ).toEqual({ ok: true, id: field[0].id });
  });

  it("rejects a Round from another Tournament", async () => {
    const f = await tournamentFixture();
    const other = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const { round } = await playerFixture(other);

    expect(
      await tournaments.assignRoundToPairing(adminId, {
        pairingId,
        roundId: round.id,
      }),
    ).toMatchObject({ ok: false });
    expect(
      await tournaments.getPairingsForTournament(f.tournament.id),
    ).toMatchObject([{ members: [] }]);
  });

  it("rejects membership changes from a non-admin", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const assigned = await playerFixture(f);
    const unassigned = await playerFixture(f);
    await tournaments.assignRoundToPairing(adminId, {
      pairingId,
      roundId: assigned.round.id,
    });
    const nonAdminId = await newPlayerId();

    expect(
      await tournaments.assignRoundToPairing(nonAdminId, {
        pairingId,
        roundId: unassigned.round.id,
      }),
    ).toEqual({ ok: false, error: "Only admins can manage Pairings." });
    expect(
      await tournaments.removeRoundFromPairing(nonAdminId, {
        roundId: assigned.round.id,
      }),
    ).toEqual({ ok: false, error: "Only admins can manage Pairings." });
    expect(
      await tournaments.getPairingsForTournament(f.tournament.id),
    ).toMatchObject([{ members: [{ roundId: assigned.round.id }] }]);
  });

  it("reassigns a player whose scores already exist and leaves those scores untouched", async () => {
    const f = await tournamentFixture();
    const first = await createPairing(f.tournament.id);
    const second = await createPairing(f.tournament.id);
    const { round } = await playerFixture(f);
    await tournaments.assignRoundToPairing(adminId, {
      pairingId: first,
      roundId: round.id,
    });
    await fixtures.scores(round.id, [{ hole: 1, strokes: 4, putts: 2 }]);

    expect(
      await tournaments.assignRoundToPairing(adminId, {
        pairingId: second,
        roundId: round.id,
      }),
    ).toMatchObject({ ok: true });
    expect((await getRoundById(round.id))?.scores).toMatchObject([
      { hole: 1, strokes: 4, putts: 2 },
    ]);
  });

  it("returns a deleted Pairing's members to unassigned without removing their Rounds", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const { round } = await playerFixture(f);
    await tournaments.assignRoundToPairing(adminId, {
      pairingId,
      roundId: round.id,
    });

    expect(
      await tournaments.deletePairing(adminId, { pairingId }),
    ).toMatchObject({ ok: true });
    expect(await tournaments.getPairingsForTournament(f.tournament.id)).toEqual(
      [],
    );
    expect(
      await tournaments.getUnassignedRoundsForTournament(f.tournament.id),
    ).toMatchObject([{ roundId: round.id }]);
  });

  it("revalidates only the Tournament edit page after each Pairing write", async () => {
    const f = await tournamentFixture();
    const { round } = await playerFixture(f);
    const pairingId = await createPairing(f.tournament.id);
    const expectedPath = `/tournaments/${f.tournament.id}/edit`;
    expect(vi.mocked(revalidatePath).mock.calls).toEqual([[expectedPath]]);
    expect(updateTag).not.toHaveBeenCalled();

    const operations = [
      () => tournaments.renamePairing(adminId, { pairingId, name: "Flight A" }),
      () =>
        tournaments.assignRoundToPairing(adminId, {
          pairingId,
          roundId: round.id,
        }),
      () => tournaments.removeRoundFromPairing(adminId, { roundId: round.id }),
      () => tournaments.deletePairing(adminId, { pairingId }),
    ];
    for (const write of operations) {
      clearCacheMocks();
      expect(await write()).toMatchObject({ ok: true });
      expect(vi.mocked(revalidatePath).mock.calls).toEqual([[expectedPath]]);
      expect(updateTag).not.toHaveBeenCalled();
    }
  });
});
