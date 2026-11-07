"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  matches,
  matchTeamMembers,
  matchTeams,
  rounds,
  users,
} from "@/db/schema";
import { getCourseIdByHandle, isTeeForCourse } from "@/lib/courses/tees";
import { parseDateOnly } from "@/lib/dates";
import { getCurrentUser } from "@/lib/users/queries";
import { invalidateHomeEventsCache } from "@/lib/home/cache";
import { pgCode } from "@/lib/pg-errors";
import {
  deleteEventRounds,
  EventCourseLockedError,
  insertEventRounds,
  invalidateRoundChanged,
  invalidateRoundsAddedOrRemoved,
  syncEventRounds,
  type ChangedRound,
} from "@/lib/rounds/lifecycle";
import {
  importRoundScorecard,
  type UploadRoundScorecardState,
} from "@/lib/rounds/scorecard-import";
import {
  MatchCreateSchema,
  MatchUpdateSchema,
  type MatchCreateValues,
  type MatchUpdateValues,
} from "./schema";

type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

async function requireCurrentUser() {
  const me = await getCurrentUser();
  if (!me) {
    throw new Error("Forbidden");
  }
  return me;
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
  const courseId = await getCourseIdByHandle(parsed.data.courseHandle);
  const { format, teeId, playerUserIds, teamOneUserIds, teamTwoUserIds } =
    parsed.data;

  if (!courseId) {
    return { ok: false, error: "Selected course does not exist." };
  }

  const teeBelongsToCourse = await isTeeForCourse(teeId, courseId);
  if (!teeBelongsToCourse) {
    return { ok: false, error: "Selected tee does not belong to this course." };
  }

  const existingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, playerUserIds));
  if (existingUsers.length !== new Set(playerUserIds).size) {
    return { ok: false, error: "One or more selected players no longer exist." };
  }

  try {
    const created = await db.transaction(async (tx) => {
      const [match] = await tx
        .insert(matches)
        .values({
          createdByUserId: me.id,
          courseId,
          date,
          format,
        })
        .returning({ id: matches.id });

      const insertedRounds = await insertEventRounds(
        tx,
        { matchId: match.id, teeId },
        playerUserIds,
      );
      const result = { matchId: match.id, insertedRounds };

      if (format !== "four_ball_match_play") return result;

      const roundIdByUserId = new Map(
        insertedRounds.map((round) => [round.userId, round.id]),
      );
      const insertedTeams = await tx
        .insert(matchTeams)
        .values([
          { matchId: match.id, name: "Team A", sortOrder: 0 },
          { matchId: match.id, name: "Team B", sortOrder: 1 },
        ])
        .returning({ id: matchTeams.id, sortOrder: matchTeams.sortOrder });
      const teamIdBySortOrder = new Map(
        insertedTeams.map((team) => [team.sortOrder, team.id]),
      );
      const teamRoundIds = [teamOneUserIds, teamTwoUserIds].map((userIds) =>
        userIds.map((userId) => roundIdByUserId.get(userId)),
      );

      await tx.insert(matchTeamMembers).values(
        teamRoundIds.flatMap((roundIds, teamIndex) => {
          const matchTeamId = teamIdBySortOrder.get(teamIndex);
          if (
            matchTeamId == null ||
            !roundIds.every((roundId): roundId is number => roundId != null)
          ) {
            throw new Error("Failed to create match teams.");
          }

          return roundIds.map((roundId) => ({
            matchTeamId,
            roundId,
          }));
        }),
      );

      return result;
    });

    invalidateRoundsAddedOrRemoved(created.insertedRounds);
    revalidatePath("/matches");
    return { ok: true, id: created.matchId };
  } catch (e: unknown) {
    if (pgCode(e) === "23503") {
      return { ok: false, error: "Selected user or course does not exist." };
    }
    throw e;
  }
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
  const format = parsed.data.format;
  const {
    playerUserIds,
    teamOneUserIds,
    teamTwoUserIds,
    teamOneRoundIds,
    teamTwoRoundIds,
    teeId,
  } = parsed.data;
  const courseId = await getCourseIdByHandle(parsed.data.courseHandle);

  if (!courseId) {
    return { ok: false, error: "Selected course does not exist." };
  }

  const matchRounds = await db
    .select({ id: rounds.id, userId: rounds.userId })
    .from(rounds)
    .where(eq(rounds.matchId, parsed.data.id));
  const roundIdByUserId = new Map(
    matchRounds.map((round) => [round.userId, round.id]),
  );
  const matchRoundIds = new Set(matchRounds.map((round) => round.id));
  const roundCount = matchRoundIds.size;

  if (format === "singles_match_play" && roundCount > 2) {
    return {
      ok: false,
      error: "Singles match play requires 2 or fewer player rounds.",
    };
  }

  if (format === "four_ball_match_play") {
    const selectedUserIds = [...teamOneUserIds, ...teamTwoUserIds];
    const canRepairFromPlayers =
      roundCount < 4 &&
      playerUserIds.length === 4 &&
      teamOneUserIds.length === 2 &&
      teamTwoUserIds.length === 2 &&
      new Set(playerUserIds).size === 4 &&
      new Set(selectedUserIds).size === 4 &&
      selectedUserIds.every((userId) => playerUserIds.includes(userId)) &&
      matchRounds.every((round) => playerUserIds.includes(round.userId));
    const selectedRoundIds = [...teamOneRoundIds, ...teamTwoRoundIds];
    const canAssignFromRounds =
      roundCount === 4 &&
      teamOneRoundIds.length === 2 &&
      teamTwoRoundIds.length === 2 &&
      new Set(selectedRoundIds).size === 4 &&
      selectedRoundIds.every((roundId) => matchRoundIds.has(roundId));

    if (!canRepairFromPlayers && !canAssignFromRounds) {
      return {
        ok: false,
        error: "Four-ball match play requires 4 rounds split into 2 teams.",
      };
    }

    if (canRepairFromPlayers) {
      const teeBelongsToCourse = await isTeeForCourse(teeId, courseId);
      if (!teeBelongsToCourse) {
        return { ok: false, error: "Selected tee does not belong to this course." };
      }

      const existingUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, playerUserIds));
      if (existingUsers.length !== 4) {
        return {
          ok: false,
          error: "One or more selected players no longer exist.",
        };
      }
    }
  }

  let insertedRounds: ChangedRound[] = [];
  let syncedRounds: ChangedRound[] = [];
  try {
    const refused = await db.transaction(async (tx) => {
      const [previous] = await tx
        .select({ courseId: matches.courseId, date: matches.date })
        .from(matches)
        .where(eq(matches.id, parsed.data.id))
        .for("update");
      if (!previous) return "Match not found.";
      // A course change moves the Rounds onto the submitted tee.
      if (
        previous.courseId !== courseId &&
        !(await isTeeForCourse(teeId, courseId, tx))
      ) {
        return "Selected tee does not belong to this course.";
      }
      await tx
      .update(matches)
      .set({ courseId, date, format })
      .where(eq(matches.id, parsed.data.id));
      // Before the Four-Ball repair, so repaired Rounds share the existing
      // Rounds' course.
      syncedRounds = await syncEventRounds(
        tx,
        { matchId: parsed.data.id, teeId },
        previous,
      );
      await tx.delete(matchTeams).where(eq(matchTeams.matchId, parsed.data.id));

      if (format !== "four_ball_match_play") return null;

      let teamRoundIds = [teamOneRoundIds, teamTwoRoundIds];

      if (roundCount < 4 && playerUserIds.length === 4) {
        const missingUserIds = playerUserIds.filter(
          (userId) => !roundIdByUserId.has(userId),
        );

        if (missingUserIds.length > 0) {
          insertedRounds = await insertEventRounds(
            tx,
            { matchId: parsed.data.id, teeId },
            missingUserIds,
          );

          for (const round of insertedRounds) {
            roundIdByUserId.set(round.userId, round.id);
          }
        }

        teamRoundIds = [teamOneUserIds, teamTwoUserIds].map((userIds) =>
          userIds.map((userId) => roundIdByUserId.get(userId)).filter(
            (roundId): roundId is number => roundId != null,
          ),
        );
      }

      const insertedTeams = await tx
        .insert(matchTeams)
        .values([
          { matchId: parsed.data.id, name: "Team A", sortOrder: 0 },
          { matchId: parsed.data.id, name: "Team B", sortOrder: 1 },
        ])
        .returning({ id: matchTeams.id, sortOrder: matchTeams.sortOrder });
      const teamIdBySortOrder = new Map(
        insertedTeams.map((team) => [team.sortOrder, team.id]),
      );
      const memberValues = teamRoundIds.flatMap(
        (roundIds, index) => {
          const matchTeamId = teamIdBySortOrder.get(index);
          if (matchTeamId == null) {
            throw new Error("Failed to create match teams.");
          }

          return roundIds.map((roundId) => ({
            matchTeamId,
            roundId,
          }));
        },
      );

      await tx.insert(matchTeamMembers).values(memberValues);
      return null;
    });
    if (refused) return { ok: false, error: refused };
  } catch (e: unknown) {
    if (e instanceof EventCourseLockedError) {
      return { ok: false, error: e.message };
    }
    if (pgCode(e) === "23503") {
      return { ok: false, error: "Selected course does not exist." };
    }
    throw e;
  }

  const changedRounds = [...syncedRounds, ...insertedRounds];
  if (changedRounds.length > 0) invalidateRoundChanged(changedRounds);
  // The Match's own date, course and format show on the home page too.
  invalidateHomeEventsCache();
  revalidatePath("/matches");
  revalidatePath(`/matches/${parsed.data.id}`);
  return { ok: true };
}

export async function deleteMatch(id: number): Promise<ActionResult> {
  const me = await requireCurrentUser();
  const manage = await canManageMatch(id, me.id, me.isAdmin);
  if (!manage.ok) return manage;

  const deletedRounds = await db.transaction(async (tx) => {
    const deleted = await deleteEventRounds(tx, { matchId: id });
    await tx.delete(matches).where(eq(matches.id, id));
    return deleted;
  });
  invalidateRoundChanged(deletedRounds);
  // The Match leaves the home page even when it has no Rounds left.
  invalidateHomeEventsCache();
  revalidatePath("/matches");
  return { ok: true };
}

const FourBallTeamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required").max(40),
  roundIds: z.tuple([
    z.number().int().positive(),
    z.number().int().positive(),
  ]),
});

const SaveFourBallTeamsSchema = z
  .object({
    matchId: z.number().int().positive(),
    teams: z.tuple([FourBallTeamSchema, FourBallTeamSchema]),
  })
  .superRefine((value, ctx) => {
    const roundIds = value.teams.flatMap((team) => team.roundIds);
    if (new Set(roundIds).size !== roundIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Each player round can only belong to one team.",
        path: ["teams"],
      });
    }
  });

export type SaveFourBallTeamsValues = z.infer<typeof SaveFourBallTeamsSchema>;

export async function saveFourBallTeams(
  values: SaveFourBallTeamsValues,
): Promise<ActionResult> {
  const me = await requireCurrentUser();

  const parsed = SaveFourBallTeamsSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { matchId, teams } = parsed.data;
  const manage = await canManageMatch(matchId, me.id, me.isAdmin);
  if (!manage.ok) return manage;

  const matchRounds = await db
    .select({ id: rounds.id })
    .from(rounds)
    .where(eq(rounds.matchId, matchId));
  const matchRoundIds = new Set(matchRounds.map((round) => round.id));
  const selectedRoundIds = teams.flatMap((team) => team.roundIds);

  if (matchRoundIds.size !== 4) {
    return { ok: false, error: "Four-ball match play requires exactly 4 rounds." };
  }

  if (
    selectedRoundIds.length !== matchRoundIds.size ||
    selectedRoundIds.some((roundId) => !matchRoundIds.has(roundId))
  ) {
    return {
      ok: false,
      error: "Teams must include every round in this match exactly once.",
    };
  }

  await db.transaction(async (tx) => {
    await tx.delete(matchTeams).where(eq(matchTeams.matchId, matchId));
    await tx
      .update(matches)
      .set({ format: "four_ball_match_play" })
      .where(eq(matches.id, matchId));

    const insertedTeams = await tx
      .insert(matchTeams)
      .values(
        teams.map((team, index) => ({
          matchId,
          name: team.name,
          sortOrder: index,
        })),
      )
      .returning({ id: matchTeams.id, sortOrder: matchTeams.sortOrder });
    const teamIdBySortOrder = new Map(
      insertedTeams.map((team) => [team.sortOrder, team.id]),
    );
    const memberValues = teams.flatMap((team, index) => {
      const matchTeamId = teamIdBySortOrder.get(index);
      if (matchTeamId == null) {
        throw new Error("Failed to create match teams.");
      }

      return team.roundIds.map((roundId) => ({
        matchTeamId,
        roundId,
      }));
    });

    await tx.insert(matchTeamMembers).values(memberValues);
  });

  invalidateHomeEventsCache();
  revalidatePath("/matches");
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}

export async function uploadMatchRoundScorecard(
  matchId: number,
  _state: UploadRoundScorecardState,
  formData: FormData,
): Promise<UploadRoundScorecardState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in." };

  const result = await importRoundScorecard({
    userId: session.user.id,
    eventKind: "match",
    eventId: matchId,
    formData,
  });
  if (!result.ok) return { error: result.error };
  redirect(result.redirectPath);
}
