import { cache } from "react";
import { and, asc, desc, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";

import {
  clubs,
  courseHoles,
  courses,
  greenies,
  roundScores,
  roundSummaries,
  rounds,
  tournaments,
  users,
} from "@/db/schema";
import type { PointRules } from "@/lib/point-rules-schema";
import {
  assignPositionPoints,
  buildPlayerStandings,
  buildRoundPoints,
  type GreenieForPoints,
  type RoundScoreForPoints,
} from "@/lib/points";
import { assessHandicap } from "@/lib/handicap";

type SeasonStandingsParams = {
  clubId: number;
  season: number;
  roundLimit?: number;
};

type LatestSeasonStandingsParams = {
  clubHandle?: string;
  roundLimit?: number;
};

type StandingUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
};

type CompleteDifferentialRound = {
  id: number;
  userId: string;
  date: Date;
  scoreDifferential: number;
};

export type StandingsRound = {
  roundId: number;
  tournamentId: number;
  userId: string;
  user: StandingUser;
  date: Date;
  courseId: number;
  courseHandle: string;
  courseName: string;
  totalStrokes: number;
  totalPutts: number;
  recordedPuttsCount: number;
  isComplete: boolean;
  playerIndex: number | null;
  courseHandicap: number;
  netStrokes: number | null;
  scores: RoundScoreForPoints[];
  greenies: GreenieForPoints[];
  points: ReturnType<typeof buildRoundPoints>;
};

export type SeasonStandings = {
  club: {
    id: number;
    handle: string;
    name: string;
  };
  season: number;
  roundLimit: number;
  pointRules: PointRules;
  tournaments: Array<{
    id: number;
    date: Date;
    season: number;
    courseId: number;
    courseHandle: string;
    courseName: string;
    rounds: StandingsRound[];
  }>;
  players: ReturnType<
    typeof buildPlayerStandings<StandingUser, StandingsRound>
  >;
};

export const getLatestSeasonStandings = cache(
  async ({ clubHandle, roundLimit = 10 }: LatestSeasonStandingsParams = {}) => {
    const [latest] = await db
      .select({
        clubId: clubs.id,
        season: tournaments.season,
      })
      .from(tournaments)
      .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
      .where(
        clubHandle
          ? and(eq(clubs.handle, clubHandle), isNotNull(tournaments.season))
          : isNotNull(tournaments.season),
      )
      .orderBy(desc(tournaments.season), desc(tournaments.date))
      .limit(1);

    if (!latest || latest.season == null) return null;

    return getSeasonStandings({
      clubId: latest.clubId,
      season: latest.season,
      roundLimit,
    });
  },
);

export const getClubSeasons = cache(async (clubId: number) => {
  const rows = await db
    .selectDistinct({ season: tournaments.season })
    .from(tournaments)
    .where(and(eq(tournaments.clubId, clubId), isNotNull(tournaments.season)))
    .orderBy(desc(tournaments.season));

  return rows.filter((row): row is { season: number } => row.season != null);
});

export const getSeasonStandings = cache(
  async ({
    clubId,
    season,
    roundLimit = 10,
  }: SeasonStandingsParams): Promise<SeasonStandings | null> => {
    const [[club], tournamentRows] = await Promise.all([
      db
        .select({
          id: clubs.id,
          handle: clubs.handle,
          name: clubs.name,
          pointRules: clubs.pointRules,
        })
        .from(clubs)
        .where(eq(clubs.id, clubId))
        .limit(1),
      db
        .select({
          id: tournaments.id,
          date: tournaments.date,
          season: tournaments.season,
          courseId: tournaments.courseId,
          courseHandle: courses.handle,
          courseName: courses.name,
        })
        .from(tournaments)
        .innerJoin(courses, eq(tournaments.courseId, courses.id))
        .where(
          and(eq(tournaments.clubId, clubId), eq(tournaments.season, season)),
        )
        .orderBy(desc(tournaments.date), desc(tournaments.id)),
    ]);

    if (!club) return null;

    const pointRules = club.pointRules as PointRules;
    const tournamentIds = tournamentRows.map((tournament) => tournament.id);

    if (tournamentIds.length === 0) {
      return {
        club: {
          id: club.id,
          handle: club.handle,
          name: club.name,
        },
        season,
        roundLimit,
        pointRules,
        tournaments: [],
        players: [],
      };
    }

    const [seasonRounds, scores, seasonGreenies] = await Promise.all([
      db
        .select({
          roundId: roundSummaries.roundId,
          tournamentId: roundSummaries.tournamentId,
          userId: roundSummaries.userId,
          date: roundSummaries.date,
          userEmail: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          image: users.image,
          courseId: roundSummaries.courseId,
          courseHandle: courses.handle,
          courseName: courses.name,
          courseSlope: roundSummaries.courseSlope,
          totalStrokes: roundSummaries.totalStrokes,
          totalPutts: roundSummaries.totalPutts,
          recordedPuttsCount: roundSummaries.recordedPuttsCount,
          isComplete: roundSummaries.isComplete,
          scoreDifferential: roundSummaries.scoreDifferential,
        })
        .from(roundSummaries)
        .innerJoin(users, eq(roundSummaries.userId, users.id))
        .innerJoin(courses, eq(roundSummaries.courseId, courses.id))
        .innerJoin(tournaments, eq(roundSummaries.tournamentId, tournaments.id))
        .where(inArray(tournaments.id, tournamentIds))
        .orderBy(
          desc(roundSummaries.date),
          asc(users.lastName),
          asc(users.firstName),
        ),
      db
        .select({
          roundId: roundScores.roundId,
          hole: roundScores.hole,
          par: courseHoles.par,
          strokes: roundScores.strokes,
        })
        .from(roundScores)
        .innerJoin(rounds, eq(roundScores.roundId, rounds.id))
        .leftJoin(
          courseHoles,
          and(
            eq(courseHoles.courseId, rounds.courseId),
            eq(courseHoles.hole, roundScores.hole),
          ),
        )
        .where(inArray(rounds.tournamentId, tournamentIds))
        .orderBy(asc(roundScores.roundId), asc(roundScores.hole)),
      db
        .select({
          roundId: greenies.roundId,
          feet: greenies.feet,
          inches: greenies.inches,
        })
        .from(greenies)
        .innerJoin(rounds, eq(greenies.roundId, rounds.id))
        .where(inArray(rounds.tournamentId, tournamentIds))
        .orderBy(asc(greenies.roundId), asc(greenies.hole)),
    ]);

    const userIds = Array.from(
      new Set(seasonRounds.map((round) => round.userId)),
    );
    const maxSeasonDate = seasonRounds.reduce<Date | null>((maxDate, round) => {
      if (!maxDate || round.date > maxDate) return round.date;
      return maxDate;
    }, null);

    const priorDifferentialRounds =
      userIds.length === 0 || maxSeasonDate == null
        ? []
        : await getPriorCompleteDifferentialRounds({
            clubId,
            userIds,
            beforeDate: maxSeasonDate,
          });

    const scoresByRoundId = groupByRoundId(scores);
    const greeniesByRoundId = groupByRoundId(seasonGreenies);
    const completeDifferentialRounds = dedupeDifferentialRounds([
      ...priorDifferentialRounds,
      ...seasonRounds.flatMap((round) => {
        if (!round.isComplete || round.scoreDifferential == null) return [];
        return [
          {
            id: round.roundId,
            userId: round.userId,
            date: round.date,
            scoreDifferential: round.scoreDifferential,
          },
        ];
      }),
    ]);

    const roundsWithHandicap = seasonRounds.map((round) => {
      const priorScoreDifferentials = completeDifferentialRounds
        .filter(
          (priorRound) =>
            priorRound.userId === round.userId && priorRound.date < round.date,
        )
        .sort(compareMostRecentDifferentialRounds)
        .slice(0, 4)
        .map((priorRound) => priorRound.scoreDifferential);
      const { playerIndex, courseHandicap, netStrokes } = assessHandicap({
        source: {
          kind: "computed",
          priorDifferentials: priorScoreDifferentials,
        },
        slope: round.courseSlope,
        totalStrokes: round.totalStrokes,
        isComplete: round.isComplete,
      });

      return {
        ...round,
        tournamentId: round.tournamentId,
        playerIndex,
        courseHandicap,
        netStrokes,
        user: {
          id: round.userId,
          email: round.userEmail,
          firstName: round.firstName,
          lastName: round.lastName,
          username: round.username,
          image: round.image,
        },
        scores: scoresByRoundId.get(round.roundId) ?? [],
        greenies: greeniesByRoundId.get(round.roundId) ?? [],
      };
    });

    const standingsTournaments = tournamentRows.map((tournament) => {
      const tournamentRounds = roundsWithHandicap
        .filter((round) => round.tournamentId === tournament.id)
        .sort(comparePlayers);
      const strokePoints = assignPositionPoints(
        tournamentRounds
          .filter(isEligibleStrokesRound)
          .sort(compareStrokesRounds),
        pointRules.strokes.positions,
      );
      const puttPoints = assignPositionPoints(
        tournamentRounds.filter(isEligiblePuttsRound).sort(comparePuttsRounds),
        pointRules.putts.positions,
      );
      const roundsWithPoints = tournamentRounds
        .map((round): StandingsRound => {
          const roundId = round.roundId;

          return {
            roundId,
            tournamentId: tournament.id,
            userId: round.userId,
            user: round.user,
            date: round.date,
            courseId: round.courseId,
            courseHandle: round.courseHandle,
            courseName: round.courseName,
            totalStrokes: round.totalStrokes,
            totalPutts: round.totalPutts,
            recordedPuttsCount: round.recordedPuttsCount,
            isComplete: round.isComplete,
            playerIndex: round.playerIndex,
            courseHandicap: round.courseHandicap,
            netStrokes: round.netStrokes,
            scores: round.scores,
            greenies: round.greenies,
            points: buildRoundPoints({
              participationPoints: pointRules.participation,
              strokePositionPoints: strokePoints.get(roundId) ?? 0,
              puttPositionPoints: puttPoints.get(roundId) ?? 0,
              scores: round.scores,
              greenies: round.greenies,
              pointRules,
            }),
          };
        })
        .sort(compareRoundPointStandings);

      return {
        ...tournament,
        season,
        rounds: roundsWithPoints,
      };
    });

    const allRoundPoints = standingsTournaments.flatMap(
      (tournament) => tournament.rounds,
    );

    return {
      club: {
        id: club.id,
        handle: club.handle,
        name: club.name,
      },
      season,
      roundLimit,
      pointRules,
      tournaments: standingsTournaments,
      players: buildPlayerStandings(allRoundPoints, { roundLimit }),
    };
  },
);

async function getPriorCompleteDifferentialRounds({
  clubId,
  userIds,
  beforeDate,
}: {
  clubId: number;
  userIds: string[];
  beforeDate: Date;
}): Promise<CompleteDifferentialRound[]> {
  const rows = await db
    .select({
      id: roundSummaries.roundId,
      userId: roundSummaries.userId,
      date: roundSummaries.date,
      scoreDifferential: roundSummaries.scoreDifferential,
    })
    .from(roundSummaries)
    .where(
      and(
        eq(roundSummaries.clubId, clubId),
        inArray(roundSummaries.userId, userIds),
        isNotNull(roundSummaries.tournamentId),
        eq(roundSummaries.isComplete, true),
        isNotNull(roundSummaries.scoreDifferential),
        lt(roundSummaries.date, beforeDate),
      ),
    )
    .orderBy(desc(roundSummaries.date), desc(roundSummaries.roundId));

  return rows.filter(
    (row): row is CompleteDifferentialRound => row.scoreDifferential != null,
  );
}

function groupByRoundId<T extends { roundId: number }>(rows: T[]) {
  const rowsByRoundId = new Map<number, T[]>();

  for (const row of rows) {
    const roundRows = rowsByRoundId.get(row.roundId) ?? [];
    roundRows.push(row);
    rowsByRoundId.set(row.roundId, roundRows);
  }

  return rowsByRoundId;
}

function dedupeDifferentialRounds(roundsToDedupe: CompleteDifferentialRound[]) {
  const roundsById = new Map<number, CompleteDifferentialRound>();

  for (const round of roundsToDedupe) {
    roundsById.set(round.id, round);
  }

  return Array.from(roundsById.values());
}

function isEligibleStrokesRound(round: {
  isComplete: boolean;
  netStrokes: number | null;
}) {
  return round.isComplete && round.netStrokes != null;
}

function isEligiblePuttsRound(round: {
  isComplete: boolean;
  recordedPuttsCount: number;
}) {
  return round.isComplete && round.recordedPuttsCount >= 18;
}

function compareStrokesRounds(
  a: {
    netStrokes: number | null;
    totalStrokes: number;
    user: StandingUser;
  },
  b: {
    netStrokes: number | null;
    totalStrokes: number;
    user: StandingUser;
  },
) {
  const netCompare = compareNullableNumbers(a.netStrokes, b.netStrokes);
  if (netCompare !== 0) return netCompare;

  const grossCompare = a.totalStrokes - b.totalStrokes;
  if (grossCompare !== 0) return grossCompare;

  return compareUsers(a.user, b.user);
}

function comparePuttsRounds(
  a: {
    totalPutts: number;
    totalStrokes: number;
    netStrokes: number | null;
    user: StandingUser;
  },
  b: {
    totalPutts: number;
    totalStrokes: number;
    netStrokes: number | null;
    user: StandingUser;
  },
) {
  const puttsCompare = a.totalPutts - b.totalPutts;
  if (puttsCompare !== 0) return puttsCompare;

  const grossCompare = a.totalStrokes - b.totalStrokes;
  if (grossCompare !== 0) return grossCompare;

  const netCompare = compareNullableNumbers(a.netStrokes, b.netStrokes);
  if (netCompare !== 0) return netCompare;

  return compareUsers(a.user, b.user);
}

function compareRoundPointStandings(a: StandingsRound, b: StandingsRound) {
  const pointsCompare = b.points.total - a.points.total;
  if (pointsCompare !== 0) return pointsCompare;
  return compareUsers(a.user, b.user);
}

function comparePlayers(a: { user: StandingUser }, b: { user: StandingUser }) {
  return compareUsers(a.user, b.user);
}

function compareUsers(a: StandingUser, b: StandingUser) {
  return (
    (a.lastName ?? "").localeCompare(b.lastName ?? "") ||
    (a.firstName ?? "").localeCompare(b.firstName ?? "") ||
    (a.username ?? "").localeCompare(b.username ?? "") ||
    a.id.localeCompare(b.id)
  );
}

function compareNullableNumbers(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

function compareMostRecentDifferentialRounds(
  a: CompleteDifferentialRound,
  b: CompleteDifferentialRound,
) {
  const dateCompare = b.date.getTime() - a.date.getTime();
  if (dateCompare !== 0) return dateCompare;
  return b.id - a.id;
}
