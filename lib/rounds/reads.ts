import { cache } from "react";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  lt,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  courseHoles,
  courseTees,
  courses,
  matches,
  roundSummaries,
  rounds,
  seasons,
  teeYardages,
  tournaments,
  users,
} from "@/db/schema";
import { assessHandicap, PLAYER_INDEX_ROUND_LIMIT } from "@/lib/handicap";
import { groupBy } from "@/lib/group-by";
import {
  groupByRoundId,
  readScorecardsByRounds,
  type RoundGreenieRow,
  type RoundScoreRow,
} from "@/lib/rounds/scorecards";
import { compareTournamentRanking } from "@/lib/tournaments/results";

// The one place Rounds are read for display (ADR 0003). The Tournament, Match
// and Round reads take their Rounds from here and add only their event fields.

type RoundBase = {
  id: number;
  userId: string;
  date: Date;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
  courseId: number;
  teeId: number;
  courseRating: string;
  courseSlope: number;
  recordedStrokesCount: number;
  recordedPuttsCount: number;
  totalStrokes: number;
  totalPutts: number;
  isComplete: boolean;
  scoreDifferential: number | null;
  playingHandicap: number | null;
  netStrokes: number | null;
  scores: RoundScoreRow[];
  greenies: RoundGreenieRow[];
  /** Per-hole yards for this Round's own tee. */
  yards: { hole: number; yards: number }[];
};

export type TournamentRound = RoundBase & {
  kind: "tournament";
  tournamentId: number;
  playingHandicap: number;
};

export type MatchRound = RoundBase & {
  kind: "match";
  matchId: number;
  playerIndexOverride: number | null;
  playingHandicap: number;
};

export type CasualRound = RoundBase & {
  kind: "casual";
  playingHandicap: null;
  netStrokes: null;
};

export type DisplayRound = TournamentRound | MatchRound | CasualRound;

/** A Round's kind together with its event's id, kept as one tagged union. */
export type RoundEvent =
  | Pick<TournamentRound, "kind" | "tournamentId">
  | Pick<MatchRound, "kind" | "matchId">
  | Pick<CasualRound, "kind">;

/** One hole of a Round's scorecard, as the score views render it. */
export type RoundHoleScore = Pick<
  RoundScoreRow,
  "hole" | "par" | "strokes" | "putts"
>;

export type RoundHoleGreenie = Pick<RoundGreenieRow, "hole" | "feet" | "inches">;

/** A Round as Match Play and Skins score it: strokes against hole handicaps. */
export type NetScoringRound = Pick<
  DisplayRound,
  | "kind"
  | "id"
  | "userId"
  | "firstName"
  | "lastName"
  | "username"
  | "image"
  | "playingHandicap"
  | "recordedStrokesCount"
> & { scores: Pick<RoundHoleScore, "hole" | "strokes">[] };

export type CourseHole = { hole: number; par: number; handicap: number };

/** The hole fields Match Play and Skins allocate received strokes by. */
export type HandicapHole = Pick<CourseHole, "hole" | "handicap">;

export type CourseTee = {
  id: number;
  name: string;
  color: string | null;
  rating: string;
  slope: number;
  totalYards: number | null;
};

export type RoundsRead<R extends DisplayRound> = {
  course: { holes: CourseHole[]; tees: CourseTee[] };
  rounds: R[];
};

export type PriorHandicapRound = {
  id: number;
  date: Date;
  courseHandle: string;
  courseName: string;
  courseRating: string;
  courseSlope: number;
  totalStrokes: number;
  scoreDifferential: number;
  usedForPlayerIndex: boolean;
};

export type HandicapDetails = {
  priorRounds: PriorHandicapRound[];
  playerIndex: number | null;
  courseHandicap: number | null;
};

// Per scope: which Rounds a read covers, and where its course comes from. A
// Round's course follows its event, so an event with no Rounds still has one.
const scopes = {
  tournament: {
    roundsIn: (id: number) => eq(rounds.tournamentId, id),
    courseOf: (id: number) =>
      db
        .select({ id: tournaments.courseId })
        .from(tournaments)
        .where(eq(tournaments.id, id)),
  },
  match: {
    roundsIn: (id: number) => eq(rounds.matchId, id),
    courseOf: (id: number) =>
      db
        .select({ id: matches.courseId })
        .from(matches)
        .where(eq(matches.id, id)),
  },
  round: {
    roundsIn: (id: number) => eq(rounds.id, id),
    courseOf: (id: number) =>
      db
        .select({ id: rounds.courseId })
        .from(rounds)
        .where(eq(rounds.id, id)),
  },
};

type Scope = { by: keyof typeof scopes; id: number };
type CourseIdQuery = ReturnType<(typeof scopes)[Scope["by"]]["courseOf"]>;

function readRoundRows(where: SQL) {
  return db
    .select({
      id: roundSummaries.roundId,
      tournamentId: roundSummaries.tournamentId,
      matchId: roundSummaries.matchId,
      playerIndexOverride: roundSummaries.playerIndexOverride,
      userId: roundSummaries.userId,
      date: roundSummaries.date,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      image: users.image,
      courseId: roundSummaries.courseId,
      teeId: rounds.teeId,
      courseRating: roundSummaries.courseRating,
      courseSlope: roundSummaries.courseSlope,
      recordedStrokesCount: roundSummaries.recordedStrokesCount,
      recordedPuttsCount: roundSummaries.recordedPuttsCount,
      totalStrokes: roundSummaries.totalStrokes,
      totalPutts: roundSummaries.totalPutts,
      isComplete: roundSummaries.isComplete,
      scoreDifferential: roundSummaries.scoreDifferential,
    })
    .from(roundSummaries)
    .innerJoin(rounds, eq(rounds.id, roundSummaries.roundId))
    .innerJoin(users, eq(users.id, roundSummaries.userId))
    .where(where);
}

function readCourseHoles(courseId: CourseIdQuery) {
  return db
    .select({
      hole: courseHoles.hole,
      par: courseHoles.par,
      handicap: courseHoles.handicap,
    })
    .from(courseHoles)
    .where(inArray(courseHoles.courseId, courseId))
    .orderBy(asc(courseHoles.hole));
}

function readCourseTees(courseId: CourseIdQuery) {
  return db
    .select({
      id: courseTees.id,
      name: courseTees.name,
      color: courseTees.color,
      rating: courseTees.rating,
      slope: courseTees.slope,
      totalYards: sql<number | null>`sum(${teeYardages.yards})::int`.mapWith(
        (value) => (value == null ? null : Number(value)),
      ),
    })
    .from(courseTees)
    .leftJoin(teeYardages, eq(teeYardages.teeId, courseTees.id))
    .where(inArray(courseTees.courseId, courseId))
    .groupBy(
      courseTees.id,
      courseTees.name,
      courseTees.color,
      courseTees.rating,
      courseTees.slope,
      courseTees.sortOrder,
    )
    .orderBy(asc(courseTees.sortOrder), asc(courseTees.id));
}

// Yards for every tee the Rounds play from, in one join.
function readTeeYards(where: SQL) {
  return db
    .selectDistinct({
      teeId: teeYardages.teeId,
      hole: teeYardages.hole,
      yards: teeYardages.yards,
    })
    .from(teeYardages)
    .innerJoin(rounds, eq(rounds.teeId, teeYardages.teeId))
    .where(where)
    .orderBy(asc(teeYardages.teeId), asc(teeYardages.hole));
}

// For every Tournament Round in `where`, its player's most recent prior
// Rounds feeding the Player Index: complete Tournament Rounds in the same
// Club, dated before the Round. One query however many players there are.
async function readPriorRounds(where: SQL) {
  const current = db
    .select({
      currentRoundId: sql<number>`${rounds.id}`.as("current_round_id"),
      currentUserId: sql<string>`${rounds.userId}`.as("current_user_id"),
      currentClubId: sql<number>`${seasons.clubId}`.as("current_club_id"),
      currentDate: sql<Date>`${rounds.date}`.as("current_date"),
    })
    .from(rounds)
    .innerJoin(tournaments, eq(tournaments.id, rounds.tournamentId))
    .innerJoin(seasons, eq(seasons.id, tournaments.seasonId))
    .where(where)
    .as("current_rounds");

  const ranked = db
    .select({
      forRoundId: current.currentRoundId,
      id: roundSummaries.roundId,
      date: roundSummaries.date,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseRating: roundSummaries.courseRating,
      courseSlope: roundSummaries.courseSlope,
      totalStrokes: roundSummaries.totalStrokes,
      scoreDifferential: roundSummaries.scoreDifferential,
      recency: sql<number>`row_number() over (partition by ${current.currentRoundId} order by ${roundSummaries.date} desc, ${roundSummaries.roundId} desc)`.as(
        "recency",
      ),
    })
    .from(current)
    .innerJoin(
      roundSummaries,
      and(
        eq(roundSummaries.userId, current.currentUserId),
        eq(roundSummaries.clubId, current.currentClubId),
        lt(roundSummaries.date, current.currentDate),
      ),
    )
    .innerJoin(courses, eq(courses.id, roundSummaries.courseId))
    .where(
      and(
        isNotNull(roundSummaries.tournamentId),
        eq(roundSummaries.isComplete, true),
        isNotNull(roundSummaries.scoreDifferential),
      ),
    )
    .as("ranked_prior_rounds");

  const rows = await db
    .select({
      forRoundId: ranked.forRoundId,
      prior: {
        id: ranked.id,
        date: ranked.date,
        courseHandle: ranked.courseHandle,
        courseName: ranked.courseName,
        courseRating: ranked.courseRating,
        courseSlope: ranked.courseSlope,
        totalStrokes: ranked.totalStrokes,
        scoreDifferential: ranked.scoreDifferential,
      },
    })
    .from(ranked)
    .where(lte(ranked.recency, PLAYER_INDEX_ROUND_LIMIT))
    .orderBy(asc(ranked.forRoundId), desc(ranked.date), desc(ranked.id));

  return groupBy(
    rows.flatMap(({ forRoundId, prior: { scoreDifferential, ...prior } }) =>
      scoreDifferential == null
        ? []
        : [{ forRoundId, prior: { ...prior, scoreDifferential } }],
    ),
    (row) => row.forRoundId,
    (row) => row.prior,
  );
}

async function readRounds({ by, id }: Scope) {
  const where = scopes[by].roundsIn(id);
  const courseId = scopes[by].courseOf(id);
  const [rows, { scores, greenies }, holes, tees, teeYards, priorByRoundId] =
    await Promise.all([
      readRoundRows(where),
      readScorecardsByRounds(where),
      readCourseHoles(courseId),
      readCourseTees(courseId),
      readTeeYards(where),
      readPriorRounds(where),
    ]);

  const scoresByRoundId = groupByRoundId(scores);
  const greeniesByRoundId = groupByRoundId(greenies);
  const yardsByTeeId = groupBy(
    teeYards,
    (row) => row.teeId,
    ({ hole, yards }) => ({ hole, yards }),
  );

  const handicapDetails = new Map<number, HandicapDetails>();
  const assessed = rows.map((row): DisplayRound => {
    const { tournamentId, matchId, playerIndexOverride, ...fields } = row;
    const shared = {
      ...fields,
      scores: scoresByRoundId.get(row.id) ?? [],
      greenies: greeniesByRoundId.get(row.id) ?? [],
      yards: yardsByTeeId.get(row.teeId) ?? [],
    };
    const strokes = {
      slope: row.courseSlope,
      totalStrokes: row.totalStrokes,
      isComplete: row.isComplete,
    };

    if (tournamentId != null) {
      const priorRounds = priorByRoundId.get(row.id) ?? [];
      const handicap = assessHandicap({
        source: { kind: "tournament", priorRounds },
        ...strokes,
      });
      const used = new Set(handicap.usedPriorRoundIds);
      handicapDetails.set(row.id, {
        priorRounds: priorRounds.map((prior) => ({
          ...prior,
          usedForPlayerIndex: used.has(prior.id),
        })),
        playerIndex: handicap.playerIndex,
        courseHandicap: handicap.courseHandicap,
      });
      return {
        ...shared,
        kind: "tournament",
        tournamentId,
        playingHandicap: handicap.playingHandicap,
        netStrokes: handicap.netStrokes,
      };
    }

    if (matchId != null) {
      const override =
        playerIndexOverride == null ? null : Number(playerIndexOverride);
      const handicap = assessHandicap({
        source: { kind: "match", playerIndexOverride: override },
        ...strokes,
      });
      return {
        ...shared,
        kind: "match",
        matchId,
        playerIndexOverride: override,
        playingHandicap: handicap.playingHandicap,
        netStrokes: handicap.netStrokes,
      };
    }

    return {
      ...shared,
      kind: "casual",
      playingHandicap: null,
      netStrokes: null,
    };
  });

  return {
    course: { holes, tees },
    rounds: assessed.sort(compareTournamentRanking),
    handicapDetails,
  };
}

/** Every Greenie of the Rounds, closest first within a hole. */
export function eventGreenies(rounds: readonly DisplayRound[]) {
  return rounds
    .flatMap((round) => round.greenies)
    .sort(
      (a, b) =>
        a.hole - b.hole ||
        a.feet * 12 + a.inches - (b.feet * 12 + b.inches),
    );
}

function ofKind<K extends DisplayRound["kind"]>(kind: K) {
  return (round: DisplayRound): round is Extract<DisplayRound, { kind: K }> =>
    round.kind === kind;
}

export const readTournamentRounds = cache(
  async (tournamentId: number): Promise<RoundsRead<TournamentRound>> => {
    const { course, rounds } = await readRounds({
      by: "tournament",
      id: tournamentId,
    });
    return { course, rounds: rounds.filter(ofKind("tournament")) };
  },
);

export const readMatchRounds = cache(
  async (matchId: number): Promise<RoundsRead<MatchRound>> => {
    const { course, rounds } = await readRounds({ by: "match", id: matchId });
    return { course, rounds: rounds.filter(ofKind("match")) };
  },
);

export type SingleRoundRead = RoundsRead<DisplayRound> & {
  handicapDetails: HandicapDetails | null;
};

/**
 * One Round, or null when it doesn't exist. With handicap details, a
 * Tournament Round's read carries the prior Rounds behind its Player Index,
 * each marked as used or not. Otherwise, and for Match and casual Rounds,
 * `handicapDetails` is null.
 */
export const readRound = cache(
  async (
    roundId: number,
    withHandicapDetails = false,
  ): Promise<SingleRoundRead | null> => {
    const { course, rounds, handicapDetails } = await readRounds({
      by: "round",
      id: roundId,
    });
    if (rounds.length === 0) return null;
    return {
      course,
      rounds,
      handicapDetails: withHandicapDetails
        ? (handicapDetails.get(roundId) ?? null)
        : null,
    };
  },
);
