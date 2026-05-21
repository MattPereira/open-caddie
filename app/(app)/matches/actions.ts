"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import { courseTees, courses, matches, rounds, users } from "@/db/schema";
import { getCurrentUser } from "@/db/queries/users";
import {
  MatchCreateSchema,
  MatchUpdateSchema,
  type MatchCreateValues,
  type MatchUpdateValues,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireCurrentUser() {
  const me = await getCurrentUser();
  if (!me) {
    throw new Error("Forbidden");
  }
  return me;
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

async function canManageMatch(matchId: number, userId: string, isAdmin: boolean) {
  const [match] = await db
    .select({ createdByUserId: matches.createdByUserId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) return { ok: false as const, error: "Match not found." };
  if (!isAdmin && match.createdByUserId !== userId) {
    return { ok: false as const, error: "Only the match creator can edit this match." };
  }
  return { ok: true as const };
}

export async function createMatch(
  values: MatchCreateValues,
): Promise<ActionResult> {
  const me = await requireCurrentUser();

  const parsed = MatchCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const date = parseDateOnly(parsed.data.date);
  const startsAt = parsed.data.startsAt;
  const name = parsed.data.name === "" ? null : parsed.data.name;
  const courseId = await getCourseIdByHandle(parsed.data.courseHandle);

  if (!courseId) {
    return { ok: false, error: "Selected course does not exist." };
  }

  try {
    await db.insert(matches).values({
      createdByUserId: me.id,
      courseId,
      date,
      startsAt,
      name,
    });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23503") {
      return { ok: false, error: "Selected user or course does not exist." };
    }
    throw e;
  }

  revalidatePath("/matches");
  return { ok: true };
}

export async function updateMatch(
  values: MatchUpdateValues,
): Promise<ActionResult> {
  const me = await requireCurrentUser();

  const parsed = MatchUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const manage = await canManageMatch(parsed.data.id, me.id, me.isAdmin);
  if (!manage.ok) return manage;

  const date = parseDateOnly(parsed.data.date);
  const startsAt = parsed.data.startsAt;
  const name = parsed.data.name === "" ? null : parsed.data.name;
  const courseId = await getCourseIdByHandle(parsed.data.courseHandle);

  if (!courseId) {
    return { ok: false, error: "Selected course does not exist." };
  }

  try {
    await db
      .update(matches)
      .set({ courseId, date, startsAt, name })
      .where(eq(matches.id, parsed.data.id));
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23503") {
      return { ok: false, error: "Selected course does not exist." };
    }
    throw e;
  }

  revalidatePath("/matches");
  revalidatePath(`/matches/${parsed.data.id}`);
  return { ok: true };
}

export async function deleteMatch(id: number): Promise<ActionResult> {
  const me = await requireCurrentUser();
  const manage = await canManageMatch(id, me.id, me.isAdmin);
  if (!manage.ok) return manage;

  const [{ value: roundCount }] = await db
    .select({ value: count() })
    .from(rounds)
    .where(eq(rounds.matchId, id));

  if (roundCount > 0) {
    return {
      ok: false,
      error: `Cannot delete: match has ${roundCount} round(s).`,
    };
  }

  await db.delete(matches).where(eq(matches.id, id));
  revalidatePath("/matches");
  return { ok: true };
}

const AddPlayersSchema = z.object({
  matchId: z.number().int().positive(),
  teeId: z.number().int().positive(),
  userIds: z.array(z.string().min(1)).min(1),
});

export type AddPlayersValues = z.infer<typeof AddPlayersSchema>;

export async function addPlayersToMatch(
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
  if (!currentUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const { matchId, teeId, userIds } = parsed.data;
  const manage = await canManageMatch(
    matchId,
    session.user.id,
    currentUser.isAdmin,
  );
  if (!manage.ok) return manage;

  const [match] = await db
    .select({
      id: matches.id,
      courseId: matches.courseId,
      date: matches.date,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) {
    return { ok: false, error: "Match not found." };
  }

  const teeBelongsToCourse = await isTeeForCourse(teeId, match.courseId);
  if (!teeBelongsToCourse) {
    return { ok: false, error: "Selected tee does not belong to this course." };
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
        matchId,
        userId,
        courseId: match.courseId,
        teeId,
        date: match.date,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: rounds.id });

  revalidatePath("/");
  revalidatePath(`/matches/${matchId}`);
  return { ok: true, added: inserted.length };
}
