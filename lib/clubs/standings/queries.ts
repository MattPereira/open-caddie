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
  computeSeasonStandings,
  type ComputedSeasonStandings,
  type SeasonStandingsRoundInput,
} from "@/lib/clubs/standings/season-standings";
import { assessHandicap, type PriorHandicapRound } from "@/lib/handicap";
import {
  readGreeniesByRounds,
  readScoresByRounds,
} from "@/lib/rounds/scorecards";

// Single declaration so it can later become a Club setting on the read side.
const COUNTED_ROUND_LIMIT = 10;

type CompleteDifferentialRound = PriorHandicapRound & { playerId: string };

export type SeasonStandings = ComputedSeasonStandings & {
  club: {
    id: number;
    handle: string;
    name: string;
  };
  season: number;
  roundLimit: number;
  pointRules: PointRules;
};

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
  }: {
    clubId: number;
    season: number;
  }): Promise<SeasonStandings | null> => {
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
    const seasonRounds =
      tournamentIds.length === 0
        ? []
        : await readStandingsRounds(clubId, tournamentIds);

    return {
      club: {
        id: club.id,
        handle: club.handle,
        name: club.name,
      },
      season,
      roundLimit: COUNTED_ROUND_LIMIT,
      pointRules,
      ...computeSeasonStandings({
        pointRules,
        countedRoundLimit: COUNTED_ROUND_LIMIT,
        tournaments: tournamentRows,
        rounds: seasonRounds,
      }),
    };
  },
);

async function readStandingsRounds(
  clubId: number,
  tournamentIds: number[],
): Promise<SeasonStandingsRoundInput[]> {
  const [seasonRounds, scores, seasonGreenies] = await Promise.all([
    db
      .select({
        roundId: roundSummaries.roundId,
        tournamentId: tournaments.id,
        playerId: roundSummaries.playerId,
        date: roundSummaries.date,
        playerEmail: users.email,
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

  const playerIds = Array.from(
    new Set(seasonRounds.map((round) => round.playerId)),
  );
  const maxSeasonDate = seasonRounds.reduce<Date | null>((maxDate, round) => {
    if (!maxDate || round.date > maxDate) return round.date;
    return maxDate;
  }, null);

  const priorDifferentialRounds =
    playerIds.length === 0 || maxSeasonDate == null
      ? []
      : await getPriorCompleteDifferentialRounds({
          clubId,
          playerIds,
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

  return seasonRounds.map((round) => {
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
      roundId: round.roundId,
      tournamentId: round.tournamentId,
      playerId: round.playerId,
      player: {
        id: round.playerId,
        email: round.playerEmail,
        firstName: round.firstName,
        lastName: round.lastName,
        username: round.username,
        image: round.image,
      },
      date: round.date,
      courseId: round.courseId,
      courseHandle: round.courseHandle,
      courseName: round.courseName,
      totalStrokes: round.totalStrokes,
      totalPutts: round.totalPutts,
      recordedPuttsCount: round.recordedPuttsCount,
      isComplete: round.isComplete,
      playerIndex,
      courseHandicap,
      netStrokes,
      scores: scoresByRoundId.get(round.roundId) ?? [],
      greenies: greeniesByRoundId.get(round.roundId) ?? [],
    };
  });
}

async function getPriorCompleteDifferentialRounds({
  clubId,
  playerIds,
  beforeDate,
}: {
  clubId: number;
  playerIds: string[];
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
        inArray(roundSummaries.playerId, playerIds),
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
