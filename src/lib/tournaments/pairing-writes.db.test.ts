import { beforeEach, describe, expect, it, vi } from "vitest";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getRoundById } from "@/lib/rounds/queries";
import * as writes from "./pairing-writes";
import * as queries from "./queries";

const cache = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/cache", () => cache);

describe("Pairing writes", () => {
  async function tournamentFixture() {
    const suffix = crypto.randomUUID();
    const [club] = await db.insert(schema.clubs).values({
      handle: `club-${suffix}`,
      name: `Club ${suffix}`,
      pointRules: { participation: 0, pars: 0, birdies: 0, eagles: 0, aces: 0, strokes: { positions: [0] }, putts: { positions: [0] }, greenies: { tiers: [{ maxFt: null, pts: 0 }] } },
    }).returning();
    const [course] = await db.insert(schema.courses).values({ handle: `course-${suffix}`, name: `Course ${suffix}` }).returning();
    const [tee] = await db.insert(schema.courseTees).values({ courseId: course.id, name: "Blue", rating: "72", slope: 120 }).returning();
    const [season] = await db.insert(schema.seasons).values({ clubId: club.id, number: 1 }).returning();
    const [tournament] = await db.insert(schema.tournaments).values({
      seasonId: season.id,
      date: new Date("2026-01-01T00:00:00.000Z"),
      courseId: course.id,
      teeId: tee.id,
    }).returning();
    return { tournament, course, tee };
  }

  // A Tournament Player: a Player with a Round in that Tournament, which is
  // what a Pairing actually holds.
  async function playerFixture(
    f: Awaited<ReturnType<typeof tournamentFixture>>,
  ) {
    const suffix = crypto.randomUUID();
    const [player] = await db
      .insert(schema.users)
      .values({ email: `player-${suffix}@example.com`, firstName: "Player", lastName: suffix })
      .returning();
    const [round] = await db
      .insert(schema.rounds)
      .values({
        tournamentId: f.tournament.id,
        playerId: player.id,
        courseId: f.course.id,
        teeId: f.tee.id,
        date: f.tournament.date,
      })
      .returning();
    return { player, round };
  }

  let adminId: string;

  async function createPairing(tournamentId: number) {
    const result = await writes.createPairing(adminId, { tournamentId });
    if (!result.ok || result.id == null) throw new Error(result.ok ? "Missing Pairing id" : result.error);
    return result.id;
  }

  async function newPlayerId(isAdmin = false) {
    const [player] = await db.insert(schema.users).values({
      email: `player-${crypto.randomUUID()}@example.com`,
      isAdmin,
    }).returning();
    return player.id;
  }

  beforeEach(async () => {
    adminId = await newPlayerId(true);
    cache.revalidatePath.mockClear();
    cache.updateTag.mockClear();
  });

  it("creates a numbered Pairing for an admin", async () => {
    const { tournament } = await tournamentFixture();
    const id = await createPairing(tournament.id);

    expect(await queries.getPairingsForTournament(tournament.id)).toMatchObject([
      { id, name: "Pairing 1", members: [] },
    ]);
  });

  it("rejects every Pairing mutation from a non-admin", async () => {
    const { tournament } = await tournamentFixture();
    const pairingId = await createPairing(tournament.id);
    const nonAdminId = await newPlayerId();

    expect(await writes.createPairing(nonAdminId, { tournamentId: tournament.id })).toEqual({ ok: false, error: "Only admins can manage Pairings." });
    expect(await writes.renamePairing(nonAdminId, { pairingId, name: "Late tee" })).toEqual({ ok: false, error: "Only admins can manage Pairings." });
    expect(await writes.deletePairing(nonAdminId, { pairingId })).toEqual({ ok: false, error: "Only admins can manage Pairings." });
    expect(await queries.getPairingsForTournament(tournament.id)).toMatchObject([{ id: pairingId, name: "Pairing 1" }]);
  });

  it("names each new Pairing by number without reusing a deleted number", async () => {
    const { tournament } = await tournamentFixture();
    const first = await createPairing(tournament.id);
    await createPairing(tournament.id);
    expect((await queries.getPairingsForTournament(tournament.id)).map(({ name }) => name)).toEqual(["Pairing 1", "Pairing 2"]);

    expect(await writes.deletePairing(adminId, { pairingId: first })).toMatchObject({ ok: true });
    await createPairing(tournament.id);
    expect((await queries.getPairingsForTournament(tournament.id)).map(({ name }) => name)).toEqual(["Pairing 2", "Pairing 3"]);
  });

  it("frees the last number again once its Pairing is deleted", async () => {
    const { tournament } = await tournamentFixture();
    await createPairing(tournament.id);
    const second = await createPairing(tournament.id);

    expect(await writes.deletePairing(adminId, { pairingId: second })).toMatchObject({ ok: true });
    await createPairing(tournament.id);
    expect((await queries.getPairingsForTournament(tournament.id)).map(({ name }) => name)).toEqual(["Pairing 1", "Pairing 2"]);
  });

  it("lists a Tournament's Pairings in the order they were created", async () => {
    const { tournament } = await tournamentFixture();
    const first = await createPairing(tournament.id);
    const second = await createPairing(tournament.id);
    const third = await createPairing(tournament.id);

    expect((await queries.getPairingsForTournament(tournament.id)).map(({ id }) => id)).toEqual([first, second, third]);
  });

  it("numbers Pairings per Tournament", async () => {
    const { tournament: first } = await tournamentFixture();
    const { tournament: second } = await tournamentFixture();
    await createPairing(first.id);
    await createPairing(second.id);
    expect((await queries.getPairingsForTournament(second.id)).map(({ name }) => name)).toEqual(["Pairing 1"]);
  });

  it("renames a Pairing", async () => {
    const { tournament } = await tournamentFixture();
    const pairingId = await createPairing(tournament.id);

    expect(await writes.renamePairing(adminId, { pairingId, name: "  8:30 tee  " })).toMatchObject({ ok: true });
    expect(await queries.getPairingsForTournament(tournament.id)).toMatchObject([{ id: pairingId, name: "8:30 tee" }]);
    expect(await writes.renamePairing(adminId, { pairingId, name: "   " })).toEqual({ ok: false, error: "Name is required" });
    expect(await writes.renamePairing(adminId, { pairingId, name: "x".repeat(61) })).toEqual({ ok: false, error: "Name is too long" });
  });

  it("deletes a Pairing and leaves the Tournament's other Pairings ordered", async () => {
    const { tournament } = await tournamentFixture();
    const first = await createPairing(tournament.id);
    const second = await createPairing(tournament.id);

    expect(await writes.deletePairing(adminId, { pairingId: first })).toMatchObject({ ok: true });
    expect(await queries.getPairingsForTournament(tournament.id)).toMatchObject([{ id: second, name: "Pairing 2" }]);
    expect(await queries.getTournamentById(tournament.id)).toMatchObject({ id: tournament.id });
  });

  it("assigns an unassigned Round to a Pairing", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const { player, round } = await playerFixture(f);
    expect(await queries.getUnassignedRoundsForTournament(f.tournament.id)).toMatchObject([{ roundId: round.id, playerId: player.id }]);

    expect(await writes.assignRoundToPairing(adminId, { pairingId, roundId: round.id })).toMatchObject({ ok: true });
    expect(await queries.getPairingsForTournament(f.tournament.id)).toMatchObject([{ id: pairingId, members: [{ roundId: round.id, playerId: player.id }] }]);
    expect(await queries.getUnassignedRoundsForTournament(f.tournament.id)).toEqual([]);
  });

  it("moves a Round from one Pairing to another", async () => {
    const f = await tournamentFixture();
    const first = await createPairing(f.tournament.id);
    const second = await createPairing(f.tournament.id);
    const { round } = await playerFixture(f);
    await writes.assignRoundToPairing(adminId, { pairingId: first, roundId: round.id });

    expect(await writes.assignRoundToPairing(adminId, { pairingId: second, roundId: round.id })).toMatchObject({ ok: true });
    expect(await queries.getPairingsForTournament(f.tournament.id)).toMatchObject([
      { id: first, members: [] },
      { id: second, members: [{ roundId: round.id }] },
    ]);
  });

  it("removes a Round from its Pairing without removing the player from the Tournament", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const { round } = await playerFixture(f);
    await writes.assignRoundToPairing(adminId, { pairingId, roundId: round.id });

    expect(await writes.removeRoundFromPairing(adminId, { roundId: round.id })).toMatchObject({ ok: true });
    expect(await queries.getPairingsForTournament(f.tournament.id)).toMatchObject([{ id: pairingId, members: [] }]);
    expect(await queries.getUnassignedRoundsForTournament(f.tournament.id)).toMatchObject([{ roundId: round.id }]);
    expect(await getRoundById(round.id)).toMatchObject({ tournamentId: f.tournament.id });
  });

  it("leaves a player added after grouping unassigned", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const early = await playerFixture(f);
    await writes.assignRoundToPairing(adminId, { pairingId, roundId: early.round.id });

    const late = await playerFixture(f);
    expect(await queries.getUnassignedRoundsForTournament(f.tournament.id)).toMatchObject([{ roundId: late.round.id }]);
    expect(await queries.getPairingsForTournament(f.tournament.id)).toMatchObject([{ members: [{ roundId: early.round.id }] }]);
  });

  it("rejects a fifth Round with a message", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const field = [];
    for (let i = 0; i < 5; i += 1) field.push((await playerFixture(f)).round);
    for (const round of field.slice(0, 4)) {
      expect(await writes.assignRoundToPairing(adminId, { pairingId, roundId: round.id })).toMatchObject({ ok: true });
    }

    const fifth = await writes.assignRoundToPairing(adminId, { pairingId, roundId: field[4].id });
    expect(fifth).toMatchObject({ ok: false, error: expect.stringContaining("4") });
    expect(await queries.getUnassignedRoundsForTournament(f.tournament.id)).toMatchObject([{ roundId: field[4].id }]);
  });

  it("admits only one of two simultaneous assignments to the last place", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const field = [];
    for (let i = 0; i < 5; i += 1) field.push((await playerFixture(f)).round);
    for (const round of field.slice(0, 3)) {
      await writes.assignRoundToPairing(adminId, { pairingId, roundId: round.id });
    }

    // Warm both connections so connection setup cannot serialize the writes.
    await Promise.all([
      db.execute(sql`select 1`),
      db.execute(sql`select 1`),
    ]);
    const results = await Promise.all(
      field.slice(3).map((round) =>
        writes.assignRoundToPairing(adminId, { pairingId, roundId: round.id }),
      ),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, error: "A Pairing holds at most 4 players." },
    ]);
    const [pairing] = await queries.getPairingsForTournament(f.tournament.id);
    expect(pairing.members).toHaveLength(4);
    const unassigned = await queries.getUnassignedRoundsForTournament(f.tournament.id);
    expect(unassigned).toHaveLength(1);
    expect(field.slice(3).map((round) => round.id)).toContain(unassigned[0].roundId);
    // Reassigning an existing member still succeeds when the Pairing is full.
    expect(await writes.assignRoundToPairing(adminId, { pairingId, roundId: field[0].id })).toEqual({ ok: true, id: field[0].id });
  });

  it("rejects a Round from another Tournament", async () => {
    const f = await tournamentFixture();
    const other = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const { round } = await playerFixture(other);

    expect(await writes.assignRoundToPairing(adminId, { pairingId, roundId: round.id })).toMatchObject({ ok: false });
    expect(await queries.getPairingsForTournament(f.tournament.id)).toMatchObject([{ members: [] }]);
  });

  it("rejects membership changes from a non-admin", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const assigned = await playerFixture(f);
    const unassigned = await playerFixture(f);
    await writes.assignRoundToPairing(adminId, { pairingId, roundId: assigned.round.id });
    const nonAdminId = await newPlayerId();

    expect(await writes.assignRoundToPairing(nonAdminId, { pairingId, roundId: unassigned.round.id })).toEqual({ ok: false, error: "Only admins can manage Pairings." });
    expect(await writes.removeRoundFromPairing(nonAdminId, { roundId: assigned.round.id })).toEqual({ ok: false, error: "Only admins can manage Pairings." });
    expect(await queries.getPairingsForTournament(f.tournament.id)).toMatchObject([{ members: [{ roundId: assigned.round.id }] }]);
  });

  it("reassigns a player whose scores already exist and leaves those scores untouched", async () => {
    const f = await tournamentFixture();
    const first = await createPairing(f.tournament.id);
    const second = await createPairing(f.tournament.id);
    const { round } = await playerFixture(f);
    await writes.assignRoundToPairing(adminId, { pairingId: first, roundId: round.id });
    await db.insert(schema.roundScores).values({ roundId: round.id, hole: 1, strokes: 4, putts: 2 });

    expect(await writes.assignRoundToPairing(adminId, { pairingId: second, roundId: round.id })).toMatchObject({ ok: true });
    expect((await getRoundById(round.id))?.scores).toMatchObject([{ hole: 1, strokes: 4, putts: 2 }]);
  });

  it("returns a deleted Pairing's members to unassigned without removing their Rounds", async () => {
    const f = await tournamentFixture();
    const pairingId = await createPairing(f.tournament.id);
    const { round } = await playerFixture(f);
    await writes.assignRoundToPairing(adminId, { pairingId, roundId: round.id });

    expect(await writes.deletePairing(adminId, { pairingId })).toMatchObject({ ok: true });
    expect(await queries.getPairingsForTournament(f.tournament.id)).toEqual([]);
    expect(await queries.getUnassignedRoundsForTournament(f.tournament.id)).toMatchObject([{ roundId: round.id }]);
  });

  it("revalidates only the Tournament edit page after each Pairing write", async () => {
    const f = await tournamentFixture();
    const { round } = await playerFixture(f);
    const pairingId = await createPairing(f.tournament.id);
    const expectedPath = `/tournaments/${f.tournament.id}/edit`;
    expect(cache.revalidatePath.mock.calls).toEqual([[expectedPath]]);
    expect(cache.updateTag).not.toHaveBeenCalled();

    const operations = [
      () => writes.renamePairing(adminId, { pairingId, name: "Flight A" }),
      () => writes.assignRoundToPairing(adminId, { pairingId, roundId: round.id }),
      () => writes.removeRoundFromPairing(adminId, { roundId: round.id }),
      () => writes.deletePairing(adminId, { pairingId }),
    ];
    for (const write of operations) {
      cache.revalidatePath.mockClear();
      expect(await write()).toMatchObject({ ok: true });
      expect(cache.revalidatePath.mock.calls).toEqual([[expectedPath]]);
      expect(cache.updateTag).not.toHaveBeenCalled();
    }
  });
});
