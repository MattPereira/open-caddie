"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  courseHoles,
  matches,
  roundScorecardUploads,
  roundScores,
  rounds,
  tournaments,
  users,
} from "@/db/schema";
import { isVercelBlobUrl } from "@/lib/blob";
import { parseRoundScorecardImage } from "@/lib/ai/round-scorecard-parser";

export type UploadRoundScorecardState = {
  error: string | null;
};

const MAX_ADDITIONAL_CONTEXT_LENGTH = 1_000;

type EventKind = "tournament" | "match";

type UploadRoundScorecardResult =
  | { ok: true; redirectPath: string; affectedUserIds: string[] }
  | { ok: false; error: string };

export async function uploadTournamentRoundScorecard(
  tournamentId: number,
  _state: UploadRoundScorecardState,
  formData: FormData,
): Promise<UploadRoundScorecardState> {
  const result = await uploadRoundScorecardForEvent({
    eventKind: "tournament",
    eventId: tournamentId,
    formData,
  });

  if (!result.ok) return { error: result.error };

  revalidateUploadPaths(result.affectedUserIds, {
    tournamentId,
    matchId: null,
  });
  redirect(result.redirectPath);
}

export async function uploadMatchRoundScorecard(
  matchId: number,
  _state: UploadRoundScorecardState,
  formData: FormData,
): Promise<UploadRoundScorecardState> {
  const result = await uploadRoundScorecardForEvent({
    eventKind: "match",
    eventId: matchId,
    formData,
  });

  if (!result.ok) return { error: result.error };

  revalidateUploadPaths(result.affectedUserIds, {
    tournamentId: null,
    matchId,
  });
  redirect(result.redirectPath);
}

async function uploadRoundScorecardForEvent({
  eventKind,
  eventId,
  formData,
}: {
  eventKind: EventKind;
  eventId: number;
  formData: FormData;
}): Promise<UploadRoundScorecardResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return { ok: false, error: "Event not found." };
  }

  const scorecardImgUrl = String(formData.get("scorecardImgUrl") ?? "").trim();
  if (!scorecardImgUrl) {
    return { ok: false, error: "Choose a scorecard image." };
  }

  if (!isVercelBlobUrl(scorecardImgUrl)) {
    return { ok: false, error: "Upload the scorecard image again." };
  }

  const selectedRoundIds = parseSelectedRoundIds(formData);
  if (selectedRoundIds.length === 0) {
    return { ok: false, error: "Select at least one player." };
  }

  const additionalContext = String(
    formData.get("additionalContext") ?? "",
  ).trim();
  if (additionalContext.length > MAX_ADDITIONAL_CONTEXT_LENGTH) {
    return {
      ok: false,
      error: "Notes must be 1,000 characters or fewer.",
    };
  }

  const event = await getWritableEvent({
    eventKind,
    eventId,
    sessionUserId: session.user.id,
  });
  if (!event.ok) return event;

  const eventRoundRows = await db
    .select({
      id: rounds.id,
      userId: rounds.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      email: users.email,
    })
    .from(rounds)
    .innerJoin(users, eq(rounds.userId, users.id))
    .where(
      and(
        eventKind === "tournament"
          ? eq(rounds.tournamentId, eventId)
          : eq(rounds.matchId, eventId),
        inArray(rounds.id, selectedRoundIds),
      ),
    )
    .orderBy(asc(users.lastName), asc(users.firstName), asc(users.username));

  const selectedRoundIdSet = new Set(selectedRoundIds);
  if (
    eventRoundRows.length !== selectedRoundIdSet.size ||
    eventRoundRows.some((round) => !selectedRoundIdSet.has(round.id))
  ) {
    return {
      ok: false,
      error: "Selected players do not belong to this event.",
    };
  }

  const holes = await db
    .select({
      hole: courseHoles.hole,
      par: courseHoles.par,
    })
    .from(courseHoles)
    .where(eq(courseHoles.courseId, event.courseId))
    .orderBy(asc(courseHoles.hole));
  if (
    holes.length !== 18 ||
    holes.some((hole, index) => hole.hole !== index + 1)
  ) {
    return {
      ok: false,
      error: "This course needs 18 configured holes before importing scores.",
    };
  }

  const roundOrder = new Map(selectedRoundIds.map((id, index) => [id, index]));
  const contextRounds = eventRoundRows
    .map((round) => ({
      roundId: round.id,
      name: displayName(round),
      order: (roundOrder.get(round.id) ?? 0) + 1,
    }))
    .sort((a, b) => a.order - b.order);

  const image = await fetchImageBytes(scorecardImgUrl);
  if (!image) {
    await insertScorecardUpload({
      eventKind,
      eventId,
      uploadedByUserId: session.user.id,
      imageUrl: scorecardImgUrl,
      additionalContext,
      status: "failed",
      error: "Could not retrieve the uploaded scorecard image.",
    });
    return {
      ok: false,
      error: "Could not retrieve the scorecard image. Please upload it again.",
    };
  }

  let parsed;
  try {
    parsed = await parseRoundScorecardImage(image.buffer, image.mediaType, {
      rounds: contextRounds,
      holes,
      additionalContext,
    });
  } catch (error) {
    console.error("Failed to parse round scorecard", error);
    await insertScorecardUpload({
      eventKind,
      eventId,
      uploadedByUserId: session.user.id,
      imageUrl: scorecardImgUrl,
      additionalContext,
      status: "failed",
      error: "Parser failed.",
    });
    return {
      ok: false,
      error: "Could not parse that scorecard. Try a clearer image or add notes.",
    };
  }

  const validationError = validateParsedRoundScores(
    parsed.parsed,
    selectedRoundIdSet,
  );
  if (validationError) {
    await insertScorecardUpload({
      eventKind,
      eventId,
      uploadedByUserId: session.user.id,
      imageUrl: scorecardImgUrl,
      additionalContext,
      status: "failed",
      parsed: parsed.parsed,
      sumCheckIssues: parsed.sumChecks,
      error: validationError,
    });
    return { ok: false, error: validationError };
  }

  const scoresToUpsert = parsed.parsed.rounds.flatMap((round) =>
    round.holes
      .filter((hole) => hole.strokes != null)
      .map((hole) => ({
        roundId: round.roundId,
        hole: hole.hole,
        strokes: hole.strokes,
        putts: hole.putts ?? null,
      })),
  );

  if (scoresToUpsert.length === 0) {
    await insertScorecardUpload({
      eventKind,
      eventId,
      uploadedByUserId: session.user.id,
      imageUrl: scorecardImgUrl,
      additionalContext,
      status: "failed",
      parsed: parsed.parsed,
      sumCheckIssues: parsed.sumChecks,
      error: "No readable scores were found.",
    });
    return {
      ok: false,
      error: "No readable scores were found on that scorecard.",
    };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(roundScorecardUploads).values({
        uploadedByUserId: session.user.id,
        tournamentId: eventKind === "tournament" ? eventId : null,
        matchId: eventKind === "match" ? eventId : null,
        imageUrl: scorecardImgUrl,
        additionalContext: additionalContext || null,
        status: "parsed",
        parsed: parsed.parsed,
        sumCheckIssues: parsed.sumChecks,
      });

      await tx
        .insert(roundScores)
        .values(scoresToUpsert)
        .onConflictDoUpdate({
          target: [roundScores.roundId, roundScores.hole],
          set: {
            strokes: sql`excluded.strokes`,
            putts: sql`coalesce(excluded.putts, ${roundScores.putts})`,
          },
        });
    });
  } catch (error: unknown) {
    const code =
      (error as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (error as { code?: string })?.code;
    if (code === "23514") {
      return { ok: false, error: "Parsed score is out of allowed range." };
    }
    throw error;
  }

  return {
    ok: true,
    redirectPath:
      eventKind === "tournament"
        ? `/tournaments/${eventId}?tab=rounds`
        : `/matches/${eventId}?tab=rounds`,
    affectedUserIds: eventRoundRows.map((round) => round.userId),
  };
}

async function fetchImageBytes(
  url: string,
): Promise<{ buffer: Buffer; mediaType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const mediaType = response.headers.get("content-type")?.split(";")[0].trim();
    if (!mediaType?.startsWith("image/")) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, mediaType };
  } catch {
    return null;
  }
}

async function insertScorecardUpload({
  eventKind,
  eventId,
  uploadedByUserId,
  imageUrl,
  additionalContext,
  status,
  parsed = null,
  sumCheckIssues = [],
  error = null,
}: {
  eventKind: EventKind;
  eventId: number;
  uploadedByUserId: string;
  imageUrl: string;
  additionalContext: string;
  status: "parsed" | "failed";
  parsed?: unknown;
  sumCheckIssues?: string[];
  error?: string | null;
}) {
  await db.insert(roundScorecardUploads).values({
    uploadedByUserId,
    tournamentId: eventKind === "tournament" ? eventId : null,
    matchId: eventKind === "match" ? eventId : null,
    imageUrl,
    additionalContext: additionalContext || null,
    status,
    parsed,
    sumCheckIssues,
    error,
  });
}

function parseSelectedRoundIds(formData: FormData) {
  return [
    ...new Set(
      formData
        .getAll("roundId")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];
}

async function getWritableEvent({
  eventKind,
  eventId,
  sessionUserId,
}: {
  eventKind: EventKind;
  eventId: number;
  sessionUserId: string;
}): Promise<
  | { ok: true; courseId: number }
  | { ok: false; error: string }
> {
  const [currentUser] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, sessionUserId))
    .limit(1);
  if (!currentUser) {
    return { ok: false, error: "You must be signed in." };
  }

  if (eventKind === "tournament") {
    const [tournament] = await db
      .select({ courseId: tournaments.courseId })
      .from(tournaments)
      .where(eq(tournaments.id, eventId))
      .limit(1);
    if (!tournament || !currentUser.isAdmin) {
      return { ok: false, error: "Tournament not found." };
    }
    return { ok: true, courseId: tournament.courseId };
  }

  const [match] = await db
    .select({
      courseId: matches.courseId,
      createdByUserId: matches.createdByUserId,
    })
    .from(matches)
    .where(eq(matches.id, eventId))
    .limit(1);
  if (
    !match ||
    (!currentUser.isAdmin && match.createdByUserId !== sessionUserId)
  ) {
    return { ok: false, error: "Match not found." };
  }

  return { ok: true, courseId: match.courseId };
}

function displayName(player: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
}) {
  const fullName = [player.firstName, player.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || player.username || player.email || "Unnamed player";
}

function validateParsedRoundScores(
  parsed: Awaited<ReturnType<typeof parseRoundScorecardImage>>["parsed"],
  selectedRoundIdSet: Set<number>,
) {
  const parsedRoundIds = new Set<number>();

  for (const round of parsed.rounds) {
    if (!selectedRoundIdSet.has(round.roundId)) {
      return "The scorecard parser returned an unexpected player.";
    }

    if (parsedRoundIds.has(round.roundId)) {
      return "The scorecard parser returned a player more than once.";
    }
    parsedRoundIds.add(round.roundId);

    const holeNumbers = round.holes.map((hole) => hole.hole);
    if (holeNumbers.some((hole, index) => hole !== index + 1)) {
      return "The scorecard parser returned holes out of order.";
    }
  }

  return null;
}

function revalidateUploadPaths(
  affectedUserIds: string[],
  event: { tournamentId: number | null; matchId: number | null },
) {
  revalidatePath("/");
  revalidatePath("/records");
  revalidatePath("/clubs/[handle]", "page");

  for (const userId of affectedUserIds) {
    revalidatePath(`/players/${userId}`);
  }

  if (event.tournamentId != null) {
    revalidatePath(`/tournaments/${event.tournamentId}`);
  }
  if (event.matchId != null) {
    revalidatePath(`/matches/${event.matchId}`);
  }
}
