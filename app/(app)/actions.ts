"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import {
  courses,
  roundScores,
  rounds,
  tournaments,
  users,
} from "@/db/schema";
import {
  RoundConfigSchema,
  RoundScoreSchema,
  type RoundConfigValues,
  type RoundScoreValues,
} from "./schema";

export async function signInWithEmail(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "No account found for this email." };
  }

  await signIn("resend", {
    email: normalized,
    redirect: false,
    redirectTo: "/",
  });

  return { ok: true };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function createRound(
  values: RoundConfigValues,
): Promise<{ ok: true; roundId: number } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundConfigSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { courseHandle, date, tournamentId } = parsed.data;

  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.handle, courseHandle))
    .limit(1);
  if (!course) {
    return { ok: false, error: "Course not found." };
  }

  if (tournamentId != null) {
    const [tournament] = await db
      .select({ id: tournaments.id, courseId: tournaments.courseId })
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);
    if (!tournament) {
      return { ok: false, error: "Tournament not found." };
    }
    if (tournament.courseId !== course.id) {
      return {
        ok: false,
        error: "Tournament course does not match selected course.",
      };
    }
  }

  try {
    const [created] = await db
      .insert(rounds)
      .values({
        userId: session.user.id,
        courseId: course.id,
        tournamentId: tournamentId ?? null,
        date: new Date(`${date}T00:00:00.000Z`),
      })
      .returning({ id: rounds.id });

    revalidatePath("/");
    return { ok: true, roundId: created.id };
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return {
        ok: false,
        error: "You already have a round for this tournament.",
      };
    }
    throw e;
  }
}

export async function deleteRound(
  roundId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const result = await db
    .delete(rounds)
    .where(and(eq(rounds.id, roundId), eq(rounds.userId, session.user.id)))
    .returning({ id: rounds.id });

  if (result.length === 0) {
    return { ok: false, error: "Round not found." };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function upsertRoundScore(
  values: RoundScoreValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundScoreSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, hole, strokes, putts } = parsed.data;

  const [owned] = await db
    .select({ id: rounds.id })
    .from(rounds)
    .where(and(eq(rounds.id, roundId), eq(rounds.userId, session.user.id)))
    .limit(1);
  if (!owned) {
    return { ok: false, error: "Round not found." };
  }

  try {
    await db
      .insert(roundScores)
      .values({ roundId, hole, strokes, putts })
      .onConflictDoUpdate({
        target: [roundScores.roundId, roundScores.hole],
        set: { strokes, putts },
      });
    return { ok: true };
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23514") {
      return { ok: false, error: "Score is out of allowed range." };
    }
    throw e;
  }
}
