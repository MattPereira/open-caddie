"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { courseTees, courses, rounds, tournaments } from "@/db/schema";
import { invalidateHomeEventsCache } from "@/lib/home/cache";
import { getRoundAccess } from "@/lib/rounds/access";
import {
  recordScorecardChanges,
  type GreenieChange,
  type ScorecardWriteResult,
} from "@/lib/rounds/scorecard-writes";
import {
  RoundConfigSchema,
  RoundGreenieDeleteSchema,
  RoundGreenieSchema,
  RoundScoreSchema,
  RoundScoresUpdateSchema,
  type RoundConfigValues,
  type RoundGreenieDeleteValues,
  type RoundGreenieValues,
  type RoundScoreValues,
  type RoundScoresUpdateValues,
} from "./schema";

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

export async function deleteRound(
  roundId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const access = await getRoundAccess(session.user.id, roundId);
  if (!access?.canManage) {
    return { ok: false, error: "Round not found." };
  }

  const result = await db
    .delete(rounds)
    .where(eq(rounds.id, roundId))
    .returning({
      id: rounds.id,
      tournamentId: rounds.tournamentId,
      matchId: rounds.matchId,
      userId: rounds.userId,
    });

  if (result.length === 0) {
    return { ok: false, error: "Round not found." };
  }

  if (result[0].tournamentId != null || result[0].matchId != null) {
    invalidateHomeEventsCache();
  }
  revalidatePath("/");
  revalidatePath("/records");
  revalidatePath("/clubs/[handle]", "page");
  revalidatePath(`/players/${result[0].userId}`);
  revalidatePath(`/rounds/${roundId}`);
  if (result[0].tournamentId != null) {
    revalidatePath(`/tournaments/${result[0].tournamentId}`);
  }
  if (result[0].matchId != null) {
    revalidatePath(`/matches/${result[0].matchId}`);
  }
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

  return toActionResult(
    await recordScorecardChanges(session.user.id, { scores: [parsed.data] }),
  );
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
  return toActionResult(
    await recordScorecardChanges(session.user.id, {
      greenies: [{ roundId, hole, distance: { feet, inches } }],
    }),
  );
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
  return toActionResult(
    await recordScorecardChanges(session.user.id, {
      greenies: [{ roundId, hole, distance: null }],
    }),
  );
}

// The round-page sheet. Still owner-or-admin and still a full 18-hole submit
// with the tee and override; splitting settings out is the next step (#57).
export async function updateRoundScores(
  values: RoundScoresUpdateValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundScoresUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { playerIndexOverride, roundId, scores, teeId } = parsed.data;

  const access = await getRoundAccess(session.user.id, roundId);
  if (!access?.canManage) {
    return { ok: false, error: "Round not found." };
  }
  const { round } = access;

  const [tee] = await db
    .select({ id: courseTees.id })
    .from(courseTees)
    .where(and(eq(courseTees.id, teeId), eq(courseTees.courseId, round.courseId)))
    .limit(1);
  if (!tee) {
    return { ok: false, error: "Selected tees do not belong to this course." };
  }

  const recorded = await recordScorecardChanges(session.user.id, {
    scores: scores.map((score) => ({
      roundId,
      hole: score.hole,
      strokes: score.strokes === "" ? null : score.strokes,
      putts: score.putts === "" ? null : score.putts,
    })),
    greenies: parsed.data.greenies.flatMap((greenie): GreenieChange[] => {
      if (greenie.action === "delete") {
        return [{ roundId, hole: greenie.hole, distance: null }];
      }
      if (
        greenie.action === "upsert" &&
        greenie.feet !== "" &&
        greenie.inches !== ""
      ) {
        return [
          {
            roundId,
            hole: greenie.hole,
            distance: { feet: greenie.feet, inches: greenie.inches },
          },
        ];
      }
      return [];
    }),
  });
  if (!recorded.ok) return toActionResult(recorded);

  await db
    .update(rounds)
    .set({
      teeId,
      ...(round.matchId != null && {
        playerIndexOverride:
          playerIndexOverride === "" ? null : playerIndexOverride.toFixed(1),
      }),
    })
    .where(eq(rounds.id, roundId));

  return { ok: true };
}

function toActionResult(
  result: ScorecardWriteResult,
): { ok: true } | { ok: false; error: string } {
  return result.ok ? result : { ok: false, error: result.error };
}
