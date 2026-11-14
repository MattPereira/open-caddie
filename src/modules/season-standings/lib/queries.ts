import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";

import { clubs, courses, seasons, tournaments } from "@/db/schema";
import type { PointRules } from "@/modules/clubs/point-rules";
import {
  computeSeasonStandings,
  type ComputedSeasonStandings,
} from "./compute";
import { getSeasonRounds } from "@/modules/rounds";

// Single declaration so it can later become a Club setting on the read side.
const COUNTED_ROUND_LIMIT = 10;

export type SeasonStandings = ComputedSeasonStandings & {
  club: {
    id: number;
    handle: string;
    name: string;
  };
  season: number;
  countedRoundLimit: number;
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
    const [[club], tournamentRows, seasonRounds] = await Promise.all([
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
      getSeasonRounds(clubId, season),
    ]);

    if (!club) return null;

    const pointRules = club.pointRules as PointRules;

    return {
      club: {
        id: club.id,
        handle: club.handle,
        name: club.name,
      },
      season,
      countedRoundLimit: COUNTED_ROUND_LIMIT,
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
