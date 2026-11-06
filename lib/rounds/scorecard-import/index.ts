import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  courseHoles,
  matches,
  roundScorecardUploads,
  rounds,
  tournaments,
  users,
} from "@/db/schema";
import { isVercelBlobUrl } from "@/lib/images/blob";
import { getRoundAccess } from "@/lib/rounds/access";
import { recordScorecardChanges } from "@/lib/rounds/scorecard-writes";
import { parseRoundScorecardImage } from "./parser";

// Not a "use server" module: it takes the session user id, so thin actions in
// the Tournament and Match routes authenticate and wrap it (ADR 0003).

export type UploadRoundScorecardState = {
  error: string | null;
};

const MAX_ADDITIONAL_CONTEXT_LENGTH = 1_000;

type EventKind = "tournament" | "match";

export type ImportRoundScorecardResult =
  | { ok: true; redirectPath: string }
  | { ok: false; error: string };

/**
 * The Round Scorecard Import: parses the uploaded image and records the scores
 * for the selected Rounds through record scorecard changes, all or nothing.
 */
export async function importRoundScorecard({
  userId,
  eventKind,
  eventId,
  formData,
}: {
  userId: string;
  eventKind: EventKind;
  eventId: number;
  formData: FormData;
}): Promise<ImportRoundScorecardResult> {
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

  const courseId = await readEventCourseId(eventKind, eventId);
  if (courseId == null) {
    return {
      ok: false,
      error:
        eventKind === "tournament" ? "Tournament not found." : "Match not found.",
    };
  }

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

  // Checked before the parser runs, so a card the uploader can't wholly score
  // costs nothing and writes nothing.
  const accesses = await Promise.all(
    selectedRoundIds.map((roundId) => getRoundAccess(userId, roundId)),
  );
  if (accesses.some((access) => !access?.canScore)) {
    return { ok: false, error: "Round not found." };
  }

  const holes = await db
    .select({
      hole: courseHoles.hole,
      par: courseHoles.par,
    })
    .from(courseHoles)
    .where(eq(courseHoles.courseId, courseId))
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
      uploadedByUserId: userId,
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
      uploadedByUserId: userId,
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
      uploadedByUserId: userId,
      imageUrl: scorecardImgUrl,
      additionalContext,
      status: "failed",
      parsed: parsed.parsed,
      sumCheckIssues: parsed.sumChecks,
      error: validationError,
    });
    return { ok: false, error: validationError };
  }

  // A hole the card leaves blank is left out entirely, and a missing putts
  // field keeps whatever putts were entered live.
  const scoreChanges = parsed.parsed.rounds.flatMap((round) =>
    round.holes
      .filter((hole) => hole.strokes != null)
      .map((hole) => ({
        roundId: round.roundId,
        hole: hole.hole,
        strokes: hole.strokes,
        ...(hole.putts != null && { putts: hole.putts }),
      })),
  );

  if (scoreChanges.length === 0) {
    await insertScorecardUpload({
      eventKind,
      eventId,
      uploadedByUserId: userId,
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

  const recorded = await recordScorecardChanges(userId, {
    scores: scoreChanges,
  });
  if (!recorded.ok) {
    const error =
      recorded.reason === "score_out_of_range"
        ? "Parsed score is out of allowed range."
        : recorded.error;
    await insertScorecardUpload({
      eventKind,
      eventId,
      uploadedByUserId: userId,
      imageUrl: scorecardImgUrl,
      additionalContext,
      status: "failed",
      parsed: parsed.parsed,
      sumCheckIssues: parsed.sumChecks,
      error,
    });
    return { ok: false, error };
  }

  await insertScorecardUpload({
    eventKind,
    eventId,
    uploadedByUserId: userId,
    imageUrl: scorecardImgUrl,
    additionalContext,
    status: "parsed",
    parsed: parsed.parsed,
    sumCheckIssues: parsed.sumChecks,
  });

  return {
    ok: true,
    redirectPath:
      eventKind === "tournament"
        ? `/tournaments/${eventId}?tab=rounds`
        : `/matches/${eventId}?tab=rounds`,
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

async function readEventCourseId(
  eventKind: EventKind,
  eventId: number,
): Promise<number | null> {
  const [event] =
    eventKind === "tournament"
      ? await db
          .select({ courseId: tournaments.courseId })
          .from(tournaments)
          .where(eq(tournaments.id, eventId))
          .limit(1)
      : await db
          .select({ courseId: matches.courseId })
          .from(matches)
          .where(eq(matches.id, eventId))
          .limit(1);
  return event?.courseId ?? null;
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
