"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  courseHoles,
  courses,
  greenies,
  roundScores,
  rounds,
  tournaments,
  users,
} from "@/db/schema";
import { getPrimaryTeeIdByCourseId } from "@/db/queries/courses";
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

  const { courseHandle, date, tournamentId } = parsed.data;

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
    teeId = await getPrimaryTeeIdByCourseId(course.id);
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

    revalidatePath("/");
    revalidatePath("/standings");
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

  const [currentUser] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!currentUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const result = await db
    .delete(rounds)
    .where(
      currentUser.isAdmin
        ? eq(rounds.id, roundId)
        : and(eq(rounds.id, roundId), eq(rounds.userId, session.user.id)),
    )
    .returning({
      id: rounds.id,
      tournamentId: rounds.tournamentId,
      userId: rounds.userId,
    });

  if (result.length === 0) {
    return { ok: false, error: "Round not found." };
  }

  revalidatePath("/");
  revalidatePath("/greenies");
  revalidatePath("/standings");
  revalidatePath(`/players/${result[0].userId}`);
  revalidatePath(`/rounds/${roundId}`);
  if (result[0].tournamentId != null) {
    revalidatePath(`/tournaments/${result[0].tournamentId}`);
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

  const { roundId, hole, strokes, putts } = parsed.data;

  const [owned] = await db
    .select({
      id: rounds.id,
      userId: rounds.userId,
      tournamentId: rounds.tournamentId,
    })
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
    revalidatePath("/");
    revalidatePath("/standings");
    revalidatePath(`/players/${owned.userId}`);
    revalidatePath(`/rounds/${roundId}`);
    if (owned.tournamentId != null) {
      revalidatePath(`/tournaments/${owned.tournamentId}`);
    }
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

  const [owned] = await db
    .select({
      id: rounds.id,
      userId: rounds.userId,
      courseId: rounds.courseId,
      tournamentId: rounds.tournamentId,
    })
    .from(rounds)
    .where(and(eq(rounds.id, roundId), eq(rounds.userId, session.user.id)))
    .limit(1);
  if (!owned) {
    return { ok: false, error: "Round not found." };
  }

  const [parThreeHole] = await db
    .select({ hole: courseHoles.hole })
    .from(courseHoles)
    .where(
      and(
        eq(courseHoles.courseId, owned.courseId),
        eq(courseHoles.hole, hole),
        eq(courseHoles.par, 3),
      ),
    )
    .limit(1);
  if (!parThreeHole) {
    return { ok: false, error: "Greenies can only be recorded on par 3 holes." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(roundScores)
        .values({ roundId, hole, strokes: null, putts: null })
        .onConflictDoNothing({
          target: [roundScores.roundId, roundScores.hole],
        });

      await tx
        .insert(greenies)
        .values({ roundId, hole, feet, inches })
        .onConflictDoUpdate({
          target: [greenies.roundId, greenies.hole],
          set: { feet, inches },
        });
    });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23514") {
      return { ok: false, error: "Greenie distance is out of allowed range." };
    }
    throw e;
  }

  revalidatePath("/");
  revalidatePath("/greenies");
  revalidatePath("/standings");
  revalidatePath(`/players/${owned.userId}`);
  revalidatePath(`/rounds/${roundId}`);
  if (owned.tournamentId != null) {
    revalidatePath(`/tournaments/${owned.tournamentId}`);
  }
  return { ok: true };
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

  const [owned] = await db
    .select({
      id: rounds.id,
      userId: rounds.userId,
      tournamentId: rounds.tournamentId,
    })
    .from(rounds)
    .where(and(eq(rounds.id, roundId), eq(rounds.userId, session.user.id)))
    .limit(1);
  if (!owned) {
    return { ok: false, error: "Round not found." };
  }

  await db
    .delete(greenies)
    .where(and(eq(greenies.roundId, roundId), eq(greenies.hole, hole)));

  revalidatePath("/");
  revalidatePath("/greenies");
  revalidatePath("/standings");
  revalidatePath(`/players/${owned.userId}`);
  revalidatePath(`/rounds/${roundId}`);
  if (owned.tournamentId != null) {
    revalidatePath(`/tournaments/${owned.tournamentId}`);
  }
  return { ok: true };
}

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

  const { roundId, scores } = parsed.data;

  const [currentUser] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!currentUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const [owned] = await db
    .select({
      id: rounds.id,
      userId: rounds.userId,
      courseId: rounds.courseId,
      tournamentId: rounds.tournamentId,
    })
    .from(rounds)
    .where(eq(rounds.id, roundId))
    .limit(1);
  if (!owned || (!currentUser.isAdmin && owned.userId !== session.user.id)) {
    return { ok: false, error: "Round not found." };
  }

  const parThreeHoles = await db
    .select({ hole: courseHoles.hole })
    .from(courseHoles)
    .where(
      and(eq(courseHoles.courseId, owned.courseId), eq(courseHoles.par, 3)),
    );
  const parThreeHoleSet = new Set(parThreeHoles.map((hole) => hole.hole));
  const changedGreenies = parsed.data.greenies.filter(
    (greenie) => greenie.action !== "none",
  );
  const invalidGreenie = changedGreenies.find(
    (greenie) => !parThreeHoleSet.has(greenie.hole),
  );
  if (invalidGreenie) {
    return { ok: false, error: "Greenies can only be recorded on par 3 holes." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(roundScores)
        .values(
          scores.map((score) => ({
            roundId,
            hole: score.hole,
            strokes: score.strokes === "" ? null : score.strokes,
            putts: score.putts === "" ? null : score.putts,
          })),
        )
        .onConflictDoUpdate({
          target: [roundScores.roundId, roundScores.hole],
          set: {
            strokes: sql`excluded.strokes`,
            putts: sql`excluded.putts`,
          },
        });

      for (const greenie of changedGreenies) {
        if (greenie.action === "delete") {
          await tx
            .delete(greenies)
            .where(
              and(
                eq(greenies.roundId, roundId),
                eq(greenies.hole, greenie.hole),
              ),
            );
        }
      }

      const greeniesToUpsert = changedGreenies.filter(
        (
          greenie,
        ): greenie is typeof greenie & {
          action: "upsert";
          feet: number;
          inches: number;
        } =>
          greenie.action === "upsert" &&
          greenie.feet !== "" &&
          greenie.inches !== "",
      );

      if (greeniesToUpsert.length > 0) {
        await tx
          .insert(greenies)
          .values(
            greeniesToUpsert.map((greenie) => ({
              roundId,
              hole: greenie.hole,
              feet: greenie.feet,
              inches: greenie.inches,
            })),
          )
          .onConflictDoUpdate({
            target: [greenies.roundId, greenies.hole],
            set: {
              feet: sql`excluded.feet`,
              inches: sql`excluded.inches`,
            },
          });
      }
      });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23514") {
      return { ok: false, error: "Score is out of allowed range." };
    }
    throw e;
  }

  revalidatePath("/");
  revalidatePath("/greenies");
  revalidatePath("/standings");
  revalidatePath(`/players/${owned.userId}`);
  revalidatePath(`/rounds/${roundId}`);
  if (owned.tournamentId != null) {
    revalidatePath(`/tournaments/${owned.tournamentId}`);
  }
  return { ok: true };
}
