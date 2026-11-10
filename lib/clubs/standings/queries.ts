import { cache } from "react";
import { and, asc, desc, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";

import {
  clubs,
  courses,
  roundSummaries,
  rounds,
  seasons,
  tournaments,
  users,
} from "@/db/schema";
import type { PointRules } from "@/lib/clubs/standings/point-rules";
import {
  assignPositionPoints,
  buildPlayerStandings,
  buildRoundPoints,
  type GreenieForPoints,
  type RoundScoreForPoints,
} from "@/lib/clubs/standings/points";
import { assessHandicap, type PriorHandicapRound } from "@/lib/handicap";
import { comparePlayers } from "@/lib/players/player-name";
import { rankPutts, rankStrokes } from "@/lib/tournaments/results";
import {
  readGreeniesByRounds,
  readScoresByRounds,
} from "@/lib/rounds/scorecards";

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

type CompleteDifferentialRound = PriorHandicapRound & { playerId: string };

export type StandingsRound = {
  roundId: number;
  tournamentId: number;
  playerId: string;
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
        clubId: seasons.clubId,
        season: seasons.number,
      })
      .from(tournaments)
      .innerJoin(seasons, eq(tournaments.seasonId, seasons.id))
      .innerJoin(clubs, eq(seasons.clubId, clubs.id))
      .where(
        clubHandle
          ? eq(clubs.handle, clubHandle)
          : undefined,
      )
      .orderBy(desc(seasons.number), desc(tournaments.date))
      .limit(1);

    if (!latest) return null;

    return getSeasonStandings({
      clubId: latest.clubId,
      season: latest.season,
      roundLimit,
    });
  },
);

export const getClubSeasons = cache(async (clubId: number) => {
  return db
    .selectDistinct({ season: seasons.number })
    .from(tournaments)
    .innerJoin(seasons, eq(tournaments.seasonId, seasons.id))
    .where(eq(seasons.clubId, clubId))
    .orderBy(desc(seasons.number));
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
          season: seasons.number,
          courseId: tournaments.courseId,
          courseHandle: courses.handle,
          courseName: courses.name,
        })
        .from(tournaments)
        .innerJoin(seasons, eq(tournaments.seasonId, seasons.id))
        .innerJoin(courses, eq(tournaments.courseId, courses.id))
        .where(
          and(eq(seasons.clubId, clubId), eq(seasons.number, season)),
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
          playerId: roundSummaries.playerId,
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
        .innerJoin(users, eq(roundSummaries.playerId, users.id))
        .innerJoin(courses, eq(roundSummaries.courseId, courses.id))
        .innerJoin(tournaments, eq(roundSummaries.tournamentId, tournaments.id))
        .where(inArray(tournaments.id, tournamentIds))
        .orderBy(
          desc(roundSummaries.date),
          asc(users.lastName),
          asc(users.firstName),
        ),
      readScoresByRounds(inArray(rounds.tournamentId, tournamentIds)),
      readGreeniesByRounds(inArray(rounds.tournamentId, tournamentIds)),
    ]);

    const userIds = Array.from(
      new Set(seasonRounds.map((round) => round.playerId)),
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

    const scoresByRoundId = Map.groupBy(scores, (row) => row.roundId);
    const greeniesByRoundId = Map.groupBy(seasonGreenies, (row) => row.roundId);
    const completeDifferentialRounds = dedupeDifferentialRounds([
      ...priorDifferentialRounds,
      ...seasonRounds.flatMap((round) => {
        if (!round.isComplete || round.scoreDifferential == null) return [];
        return [
          {
            id: round.roundId,
            playerId: round.playerId,
            date: round.date,
            scoreDifferential: round.scoreDifferential,
          },
        ];
      }),
    ]);

    const roundsWithHandicap = seasonRounds.map((round) => {
      const priorRounds = completeDifferentialRounds.filter(
        (priorRound) =>
          priorRound.playerId === round.playerId && priorRound.date < round.date,
      );
      const { playerIndex, courseHandicap, netStrokes } = assessHandicap({
        source: { kind: "tournament", priorRounds },
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
          id: round.playerId,
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
        rankStrokes(tournamentRounds),
        pointRules.strokes.positions,
      );
      const puttPoints = assignPositionPoints(
        rankPutts(tournamentRounds),
        pointRules.putts.positions,
      );
      const roundsWithPoints = tournamentRounds
        .map((round): StandingsRound => {
          const roundId = round.roundId;

          return {
            roundId,
            tournamentId: tournament.id,
            playerId: round.playerId,
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
      playerId: roundSummaries.playerId,
      date: roundSummaries.date,
      scoreDifferential: roundSummaries.scoreDifferential,
    })
    .from(roundSummaries)
    .where(
      and(
        eq(roundSummaries.clubId, clubId),
        inArray(roundSummaries.playerId, userIds),
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

function dedupeDifferentialRounds(roundsToDedupe: CompleteDifferentialRound[]) {
  const roundsById = new Map<number, CompleteDifferentialRound>();

  for (const round of roundsToDedupe) {
    roundsById.set(round.id, round);
  }

  return Array.from(roundsById.values());
}

function compareRoundPointStandings(a: StandingsRound, b: StandingsRound) {
  const pointsCompare = b.points.total - a.points.total;
  if (pointsCompare !== 0) return pointsCompare;
  return comparePlayers(
    { ...a.user, playerId: a.playerId },
    { ...b.user, playerId: b.playerId },
  );
}
