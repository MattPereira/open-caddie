"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { courseTees, courses, rounds, tournaments } from "@/db/schema";
import { invalidateHomeEventsCache } from "@/lib/home/cache";
import * as scorecardWrites from "@/lib/rounds/scorecard-writes";
import {
  RoundConfigSchema,
  RoundGreenieDeleteSchema,
  RoundGreenieSchema,
  RoundScorecardChangesSchema,
  RoundScoreSchema,
  RoundSettingsSchema,
  type RoundConfigValues,
  type RoundGreenieDeleteValues,
  type RoundGreenieValues,
  type RoundScorecardChangesValues,
  type RoundScoreValues,
  type RoundSettingsValues,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

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

  const { courseHandle, date, tournamentId, teeId: formTeeId } = parsed.data;

  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.handle, courseHandle))
    .limit(1);
  if (!course) {
    return { ok: false, error: "Course not found." };
  }

  let teeId: number | null = null;
  if (tournamentId != null) {
    const [tournament] = await db
      .select({
        id: tournaments.id,
        courseId: tournaments.courseId,
        teeId: tournaments.teeId,
      })
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
    teeId = tournament.teeId;
  } else {
    if (formTeeId == null) {
      return { ok: false, error: "Tees are required." };
    }
    const [tee] = await db
      .select({ id: courseTees.id })
      .from(courseTees)
      .where(
        and(eq(courseTees.id, formTeeId), eq(courseTees.courseId, course.id)),
      )
      .limit(1);
    if (!tee) {
      return {
        ok: false,
        error: "Selected tees do not belong to this course.",
      };
    }
    teeId = formTeeId;
  }

  if (!teeId) {
    return { ok: false, error: "Selected course has no tees configured." };
  }

  try {
    const [created] = await db
      .insert(rounds)
      .values({
        userId: session.user.id,
        courseId: course.id,
        teeId,
        tournamentId: tournamentId ?? null,
        date: new Date(`${date}T00:00:00.000Z`),
      })
      .returning({ id: rounds.id });

    if (tournamentId != null) invalidateHomeEventsCache();
    revalidatePath("/");
    revalidatePath("/clubs/[handle]", "page");
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

export async function deleteRound(roundId: number): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  return scorecardWrites.deleteRound(session.user.id, roundId);
}

export async function changeRoundSettings(
  values: RoundSettingsValues,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, teeId, playerIndexOverride } = parsed.data;
  return scorecardWrites.changeRoundSettings(session.user.id, roundId, {
    teeId,
    playerIndexOverride: playerIndexOverride === "" ? null : playerIndexOverride,
  });
}

export async function recordRoundScorecardChanges(
  values: RoundScorecardChangesValues,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundScorecardChangesSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, scores, greenies } = parsed.data;
  return scorecardWrites.recordScorecardChanges(session.user.id, {
    scores: scores.map((score) => ({ roundId, ...score })),
    greenies: greenies.map((greenie) => ({ roundId, ...greenie })),
  });
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

  return scorecardWrites.recordScorecardChanges(session.user.id, {
    scores: [parsed.data],
  });
}

export async function upsertRoundGreenie(
  values: RoundGreenieValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundGreenieSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, hole, feet, inches } = parsed.data;
  return scorecardWrites.recordScorecardChanges(session.user.id, {
    greenies: [{ roundId, hole, distance: { feet, inches } }],
  });
}

export async function deleteRoundGreenie(
  values: RoundGreenieDeleteValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundGreenieDeleteSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, hole } = parsed.data;
  return scorecardWrites.recordScorecardChanges(session.user.id, {
    greenies: [{ roundId, hole, distance: null }],
  });
}
