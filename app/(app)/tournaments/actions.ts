"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import { rounds, tournaments, users } from "@/db/schema";

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

  revalidatePath("/");
  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true, added: inserted.length };
}
