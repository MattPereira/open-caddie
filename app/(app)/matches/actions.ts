"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  courseTees,
  courses,
  matches,
  matchTeamMembers,
  matchTeams,
  rounds,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/users/queries";
import { invalidateHomeEventsCache } from "@/lib/home/cache";
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
    const matchId = await db.transaction(async (tx) => {
      const [match] = await tx
        .insert(matches)
        .values({
          createdByUserId: me.id,
          courseId,
          date,
          format,
        })
        .returning({ id: matches.id });

      const insertedRounds = await tx
        .insert(rounds)
        .values(
          playerUserIds.map((userId) => ({
            matchId: match.id,
            userId,
            courseId,
            teeId,
            date,
          })),
        )
        .returning({ id: rounds.id, userId: rounds.userId });

      if (format !== "four_ball_match_play") return match.id;

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

      return match.id;
    });

    invalidateHomeEventsCache();
    revalidatePath("/");
    revalidatePath("/matches");
    return { ok: true, id: matchId };
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23503") {
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

  try {
    await db.transaction(async (tx) => {
      await tx
      .update(matches)
      .set({ courseId, date, format })
      .where(eq(matches.id, parsed.data.id));
      await tx.delete(matchTeams).where(eq(matchTeams.matchId, parsed.data.id));

      if (format !== "four_ball_match_play") return;

      let teamRoundIds = [teamOneRoundIds, teamTwoRoundIds];

      if (roundCount < 4 && playerUserIds.length === 4) {
        const missingUserIds = playerUserIds.filter(
          (userId) => !roundIdByUserId.has(userId),
        );

        if (missingUserIds.length > 0) {
          const insertedRounds = await tx
            .insert(rounds)
            .values(
              missingUserIds.map((userId) => ({
                matchId: parsed.data.id,
                userId,
                courseId,
                teeId,
                date,
              })),
            )
            .returning({ id: rounds.id, userId: rounds.userId });

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
    });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23503") {
      return { ok: false, error: "Selected course does not exist." };
    }
    throw e;
  }

  invalidateHomeEventsCache();
  revalidatePath("/matches");
  revalidatePath(`/matches/${parsed.data.id}`);
  return { ok: true };
}

export async function deleteMatch(id: number): Promise<ActionResult> {
  const me = await requireCurrentUser();
  const manage = await canManageMatch(id, me.id, me.isAdmin);
  if (!manage.ok) return manage;

  await db.transaction(async (tx) => {
    await tx.delete(rounds).where(eq(rounds.matchId, id));
    await tx.delete(matches).where(eq(matches.id, id));
  });
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
