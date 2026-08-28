"use server";

import { revalidatePath } from "next/cache";
import { and, asc, count, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  clubs,
  courseTees,
  courses,
  pairingMembers,
  pairings,
  rounds,
  seasons,
  tournaments,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/users/queries";
import { PAIRING_MAX_MEMBERS } from "@/lib/tournaments/pairings";
import { invalidateHomeEventsCache } from "@/lib/home/cache";
import {
  TournamentCreateSchema,
  TournamentUpdateSchema,
  type TournamentCreateValues,
  type TournamentUpdateValues,
} from "./schema";

export type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    throw new Error("Forbidden");
  }
  return me;
}

async function getClubIdByHandle(handle: string) {
  const [club] = await db
    .select({ id: clubs.id })
    .from(clubs)
    .where(eq(clubs.handle, handle))
    .limit(1);
  return club?.id ?? null;
}

async function getCourseIdByHandle(handle: string) {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.handle, handle))
    .limit(1);
  return course?.id ?? null;
}

async function isTeeForCourse(teeId: number, courseId: number) {
  const [row] = await db
    .select({ id: courseTees.id })
    .from(courseTees)
    .where(and(eq(courseTees.id, teeId), eq(courseTees.courseId, courseId)))
    .limit(1);
  return row != null;
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function createTournament(
  values: TournamentCreateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = TournamentCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { clubHandle } = parsed.data;
  const date = parseDateOnly(parsed.data.date);
  const courseHandle = parsed.data.courseHandle;
  const clubId = await getClubIdByHandle(clubHandle);
  const courseId = await getCourseIdByHandle(courseHandle);

  if (!clubId || !courseId) {
    return { ok: false, error: "Selected club or course does not exist." };
  }

  const teeId = parsed.data.teeId;
  const teeBelongsToCourse = await isTeeForCourse(teeId, courseId);
  if (!teeBelongsToCourse) {
    return { ok: false, error: "Selected tee does not belong to this course." };
  }

  try {
    const tournament = await createTournamentRecord({
      clubId,
      seasonId: parsed.data.seasonId === "" ? null : parsed.data.seasonId,
      startNextSeason: parsed.data.startNextSeason,
      date,
      courseId,
      teeId,
    });

    invalidateHomeEventsCache();
    revalidatePath("/");
    revalidatePath("/tournaments");
    revalidatePath("/clubs/[handle]", "page");
    return { ok: true, id: tournament.id };
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23503") {
      return { ok: false, error: "Selected club or course does not exist." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Could not create Tournament." };
  }
}

export async function updateTournament(
  values: TournamentUpdateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = TournamentUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { id, clubHandle } = parsed.data;
  const date = parseDateOnly(parsed.data.date);
  const courseHandle = parsed.data.courseHandle;
  const clubId = await getClubIdByHandle(clubHandle);
  const courseId = await getCourseIdByHandle(courseHandle);

  if (!clubId || !courseId) {
    return { ok: false, error: "Selected club or course does not exist." };
  }

  const [current] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);
  if (!current) {
    return { ok: false, error: "Tournament not found." };
  }

  const teeId = parsed.data.teeId;
  const teeBelongsToCourse = await isTeeForCourse(teeId, courseId);
  if (!teeBelongsToCourse) {
    return { ok: false, error: "Selected tee does not belong to this course." };
  }

  try {
    await updateTournamentRecord({ id, clubId, seasonId: parsed.data.seasonId as number, date, courseId, teeId });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23503") {
      return { ok: false, error: "Selected club or course does not exist." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Could not update Tournament." };
  }

  invalidateHomeEventsCache();
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${id}`);
  revalidatePath(`/tournaments/${id}/edit`);
  revalidatePath("/clubs/[handle]", "page");
  return { ok: true };
}

type TournamentFields = {
  clubId: number;
  seasonId: number | null;
  date: Date;
  courseId: number;
  teeId: number;
};

async function createTournamentRecord(values: TournamentFields & { startNextSeason: boolean }) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from clubs where id = ${values.clubId} for update`);
    let season = values.seasonId == null ? null : await getSeason(tx, values.seasonId, values.clubId);

    if (values.startNextSeason) {
      const current = await getCurrentSeason(tx, values.clubId);
      [season] = await tx.insert(seasons).values({ clubId: values.clubId, number: (current?.number ?? 0) + 1 }).returning();
    } else if (!season) {
      season = await getCurrentSeason(tx, values.clubId);
      if (!season) [season] = await tx.insert(seasons).values({ clubId: values.clubId, number: 1 }).returning();
    }

    const [tournament] = await tx.insert(tournaments).values({
      seasonId: season.id,
      date: values.date,
      courseId: values.courseId,
      teeId: values.teeId,
    }).returning({ id: tournaments.id });
    return { id: tournament.id };
  });
}

async function updateTournamentRecord(values: TournamentFields & { id: number }) {
  if (values.seasonId == null) throw new Error("Season is required.");
  const season = await getSeason(db, values.seasonId, values.clubId);
  await db.update(tournaments).set({
    seasonId: season.id,
    date: values.date,
    courseId: values.courseId,
    teeId: values.teeId,
  }).where(eq(tournaments.id, values.id));
}

type SeasonReader = Pick<typeof db, "select">;

// A Club's Current Season is its highest-numbered one; null until it has any.
async function getCurrentSeason(reader: SeasonReader, clubId: number) {
  const [season] = await reader.select().from(seasons).where(eq(seasons.clubId, clubId)).orderBy(desc(seasons.number)).limit(1);
  return season ?? null;
}

async function getSeason(reader: SeasonReader, seasonId: number, clubId: number) {
  const [season] = await reader.select().from(seasons).where(and(eq(seasons.id, seasonId), eq(seasons.clubId, clubId))).limit(1);
  if (!season) throw new Error("Selected Season does not belong to this Club.");
  return season;
}

export async function deleteTournament(id: number): Promise<ActionResult> {
  await requireAdmin();

  const [{ value: roundCount }] = await db
    .select({ value: count() })
    .from(rounds)
    .where(eq(rounds.tournamentId, id));

  if (roundCount > 0) {
    return {
      ok: false,
      error: `Cannot delete: tournament has ${roundCount} round(s).`,
    };
  }

  await db.delete(tournaments).where(eq(tournaments.id, id));
  invalidateHomeEventsCache();
  revalidatePath("/tournaments");
  revalidatePath("/clubs/[handle]", "page");
  return { ok: true };
}

const AddPlayersSchema = z.object({
  tournamentId: z.number().int().positive(),
  userIds: z.array(z.string().min(1)).min(1),
});

export type AddPlayersValues = z.infer<typeof AddPlayersSchema>;

export async function addPlayersToTournament(
  values: AddPlayersValues,
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = AddPlayersSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const [currentUser] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!currentUser?.isAdmin) {
    return { ok: false, error: "Only admins can add players." };
  }

  const { tournamentId, userIds } = parsed.data;

  const [tournament] = await db
    .select({
      id: tournaments.id,
      courseId: tournaments.courseId,
      teeId: tournaments.teeId,
      date: tournaments.date,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) {
    return { ok: false, error: "Tournament not found." };
  }

  const existingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, userIds));
  if (existingUsers.length !== new Set(userIds).size) {
    return { ok: false, error: "One or more selected players no longer exist." };
  }

  const inserted = await db
    .insert(rounds)
    .values(
      userIds.map((userId) => ({
        tournamentId,
        userId,
        courseId: tournament.courseId,
        teeId: tournament.teeId,
        date: tournament.date,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: rounds.id });

  invalidateHomeEventsCache();
  revalidatePath("/");
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/edit`);
  return { ok: true, added: inserted.length };
}

const PairingCreateSchema = z.object({
  tournamentId: z.number().int().positive(),
});

const PairingRenameSchema = z.object({
  pairingId: z.number().int().positive(),
  name: z.string().trim().min(1, "Name is required").max(60, "Name is too long"),
});

const PairingDeleteSchema = z.object({
  pairingId: z.number().int().positive(),
});

const PairingMoveSchema = z.object({
  pairingId: z.number().int().positive(),
  direction: z.enum(["up", "down"]),
});

const PairingAssignSchema = z.object({
  pairingId: z.number().int().positive(),
  roundId: z.number().int().positive(),
});

const PairingUnassignSchema = z.object({
  roundId: z.number().int().positive(),
});

export type PairingCreateValues = z.infer<typeof PairingCreateSchema>;
export type PairingRenameValues = z.infer<typeof PairingRenameSchema>;
export type PairingDeleteValues = z.infer<typeof PairingDeleteSchema>;
export type PairingMoveValues = z.infer<typeof PairingMoveSchema>;
export type PairingAssignValues = z.infer<typeof PairingAssignSchema>;
export type PairingUnassignValues = z.infer<typeof PairingUnassignSchema>;

async function isAdmin() {
  const me = await getCurrentUser();
  return me?.isAdmin === true;
}

// Pairings do not appear in home events, and play pages are force-dynamic, so
// every Pairing write revalidates the Tournament edit page and nothing else.

async function getPairingTournamentId(pairingId: number) {
  const [pairing] = await db
    .select({ tournamentId: pairings.tournamentId })
    .from(pairings)
    .where(eq(pairings.id, pairingId))
    .limit(1);
  return pairing?.tournamentId ?? null;
}

export async function createPairing(
  values: PairingCreateValues,
): Promise<ActionResult> {
  if (!(await isAdmin())) {
    return { ok: false, error: "Only admins can manage Pairings." };
  }

  const parsed = PairingCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { tournamentId } = parsed.data;
  const [tournament] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) {
    return { ok: false, error: "Tournament not found." };
  }

  // A new Pairing is named and ordered by the number after the Tournament's
  // highest, read under a lock on the Tournament so two quick creates cannot
  // land on the same number. Deleting the last Pairing frees its number again,
  // which is harmless: the Pairing that held the name is gone.
  const created = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from tournaments where id = ${tournamentId} for update`,
    );
    const [highest] = await tx
      .select({ sortOrder: pairings.sortOrder })
      .from(pairings)
      .where(eq(pairings.tournamentId, tournamentId))
      .orderBy(desc(pairings.sortOrder))
      .limit(1);
    const number = (highest?.sortOrder ?? 0) + 1;
    const [pairing] = await tx
      .insert(pairings)
      .values({ tournamentId, name: `Pairing ${number}`, sortOrder: number })
      .returning({ id: pairings.id });
    return pairing;
  });

  revalidatePath(`/tournaments/${tournamentId}/edit`);
  return { ok: true, id: created.id };
}

export async function renamePairing(
  values: PairingRenameValues,
): Promise<ActionResult> {
  if (!(await isAdmin())) {
    return { ok: false, error: "Only admins can manage Pairings." };
  }

  const parsed = PairingRenameSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { pairingId, name } = parsed.data;
  const tournamentId = await getPairingTournamentId(pairingId);
  if (tournamentId == null) {
    return { ok: false, error: "Pairing not found." };
  }

  await db.update(pairings).set({ name }).where(eq(pairings.id, pairingId));
  revalidatePath(`/tournaments/${tournamentId}/edit`);
  return { ok: true, id: pairingId };
}

export async function deletePairing(
  values: PairingDeleteValues,
): Promise<ActionResult> {
  if (!(await isAdmin())) {
    return { ok: false, error: "Only admins can manage Pairings." };
  }

  const parsed = PairingDeleteSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { pairingId } = parsed.data;
  const tournamentId = await getPairingTournamentId(pairingId);
  if (tournamentId == null) {
    return { ok: false, error: "Pairing not found." };
  }

  // Membership rows cascade; the Rounds themselves stay in the Tournament.
  await db.delete(pairings).where(eq(pairings.id, pairingId));
  revalidatePath(`/tournaments/${tournamentId}/edit`);
  return { ok: true, id: pairingId };
}

export async function movePairing(
  values: PairingMoveValues,
): Promise<ActionResult> {
  if (!(await isAdmin())) {
    return { ok: false, error: "Only admins can manage Pairings." };
  }

  const parsed = PairingMoveSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { pairingId, direction } = parsed.data;
  // Moving swaps sort orders with the adjacent Pairing, under a lock on the
  // Tournament so a concurrent move or create cannot read a half-done swap.
  const moved = await db.transaction(async (tx) => {
    const [pairing] = await tx
      .select()
      .from(pairings)
      .where(eq(pairings.id, pairingId))
      .limit(1);
    if (!pairing) return { ok: false as const, error: "Pairing not found." };

    await tx.execute(
      sql`select id from tournaments where id = ${pairing.tournamentId} for update`,
    );
    const [neighbour] = await tx
      .select()
      .from(pairings)
      .where(
        and(
          eq(pairings.tournamentId, pairing.tournamentId),
          direction === "up"
            ? lt(pairings.sortOrder, pairing.sortOrder)
            : gt(pairings.sortOrder, pairing.sortOrder),
        ),
      )
      .orderBy(
        direction === "up"
          ? desc(pairings.sortOrder)
          : asc(pairings.sortOrder),
      )
      .limit(1);
    if (!neighbour) {
      return { ok: false as const, error: "Pairing is already at the end." };
    }

    await tx
      .update(pairings)
      .set({ sortOrder: pairing.sortOrder })
      .where(eq(pairings.id, neighbour.id));
    await tx
      .update(pairings)
      .set({ sortOrder: neighbour.sortOrder })
      .where(eq(pairings.id, pairingId));
    return { ok: true as const, tournamentId: pairing.tournamentId };
  });

  if (!moved.ok) return moved;
  revalidatePath(`/tournaments/${moved.tournamentId}/edit`);
  return { ok: true, id: pairingId };
}

// Assigning is also how a Round moves between Pairings: membership is keyed by
// Round, so the old row is replaced rather than added to. Reassignment stays
// possible after scores exist — scores live on the player's own Round and a
// Pairing only gates who may write, so there is nothing to unwind.
export async function assignRoundToPairing(
  values: PairingAssignValues,
): Promise<ActionResult> {
  if (!(await isAdmin())) {
    return { ok: false, error: "Only admins can manage Pairings." };
  }

  const parsed = PairingAssignSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { pairingId, roundId } = parsed.data;
  const assigned = await db.transaction(async (tx) => {
    const [pairing] = await tx
      .select({ tournamentId: pairings.tournamentId })
      .from(pairings)
      .where(eq(pairings.id, pairingId))
      .limit(1);
    if (!pairing) return { ok: false as const, error: "Pairing not found." };

    // The cap is counted under a lock on the Tournament so two concurrent
    // assignments cannot both read a Pairing of three and each add a fourth.
    await tx.execute(
      sql`select id from tournaments where id = ${pairing.tournamentId} for update`,
    );

    const [round] = await tx
      .select({ tournamentId: rounds.tournamentId })
      .from(rounds)
      .where(eq(rounds.id, roundId))
      .limit(1);
    if (!round) return { ok: false as const, error: "Player's round not found." };
    if (round.tournamentId !== pairing.tournamentId) {
      return {
        ok: false as const,
        error: "That player is not in this Tournament.",
      };
    }

    const [existing] = await tx
      .select({ pairingId: pairingMembers.pairingId })
      .from(pairingMembers)
      .where(eq(pairingMembers.roundId, roundId))
      .limit(1);
    if (existing?.pairingId === pairingId) {
      return { ok: true as const, tournamentId: pairing.tournamentId };
    }

    const [members] = await tx
      .select({ value: count() })
      .from(pairingMembers)
      .where(eq(pairingMembers.pairingId, pairingId));
    if ((members?.value ?? 0) >= PAIRING_MAX_MEMBERS) {
      return {
        ok: false as const,
        error: `A Pairing holds at most ${PAIRING_MAX_MEMBERS} players.`,
      };
    }

    if (existing) {
      await tx.delete(pairingMembers).where(eq(pairingMembers.roundId, roundId));
    }
    await tx.insert(pairingMembers).values({
      tournamentId: pairing.tournamentId,
      pairingId,
      roundId,
    });
    return { ok: true as const, tournamentId: pairing.tournamentId };
  });

  if (!assigned.ok) return assigned;
  revalidatePath(`/tournaments/${assigned.tournamentId}/edit`);
  return { ok: true, id: roundId };
}

// Removing a Round from its Pairing returns it to the unassigned bucket; the
// Round itself stays in the Tournament.
export async function removeRoundFromPairing(
  values: PairingUnassignValues,
): Promise<ActionResult> {
  if (!(await isAdmin())) {
    return { ok: false, error: "Only admins can manage Pairings." };
  }

  const parsed = PairingUnassignSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId } = parsed.data;
  const [member] = await db
    .select({ tournamentId: pairingMembers.tournamentId })
    .from(pairingMembers)
    .where(eq(pairingMembers.roundId, roundId))
    .limit(1);
  if (!member) {
    return { ok: false, error: "That player is not in a Pairing." };
  }

  await db.delete(pairingMembers).where(eq(pairingMembers.roundId, roundId));
  revalidatePath(`/tournaments/${member.tournamentId}/edit`);
  return { ok: true, id: roundId };
}
