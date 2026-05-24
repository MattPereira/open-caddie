import { cache } from "react";
import { and, asc, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clubMembers,
  clubs,
  courseHoles,
  courseTees,
  courses,
  greenies,
  roundScores,
  roundSummaries,
  rounds,
  teeYardages,
  tournaments,
  users,
} from "@/db/schema";
import {
  calculateNetStrokes,
  calculatePlayerIndex,
  calculateCourseHandicap,
} from "@/lib/scoring";
import { getPriorClubScoreDifferentials } from "./rounds";

export const getAllTournaments = cache(async () => {
  return db
    .select({
      id: tournaments.id,
      clubId: tournaments.clubId,
      clubHandle: clubs.handle,
      clubName: clubs.name,
      date: tournaments.date,
      season: tournaments.season,
      courseId: tournaments.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      playerCount: count(rounds.id).mapWith(Number),
    })
    .from(tournaments)
    .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
    .leftJoin(courses, eq(tournaments.courseId, courses.id))
    .leftJoin(rounds, eq(rounds.tournamentId, tournaments.id))
    .groupBy(tournaments.id, clubs.handle, clubs.name, courses.handle, courses.name, courses.imgUrl)
    .orderBy(desc(tournaments.date), desc(tournaments.id));
});

export const getTournamentsByClubHandle = cache(async (clubHandle: string) => {
  return db
    .select({
      id: tournaments.id,
      clubId: tournaments.clubId,
      clubHandle: clubs.handle,
      clubName: clubs.name,
      date: tournaments.date,
      season: tournaments.season,
      courseId: tournaments.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      playerCount: count(rounds.id).mapWith(Number),
    })
    .from(tournaments)
    .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
    .leftJoin(courses, eq(tournaments.courseId, courses.id))
    .leftJoin(rounds, eq(rounds.tournamentId, tournaments.id))
    .where(eq(clubs.handle, clubHandle))
    .groupBy(tournaments.id, clubs.handle, clubs.name, courses.handle, courses.name, courses.imgUrl)
    .orderBy(desc(tournaments.date), desc(tournaments.id));
});

export const getTournamentById = cache(async (tournamentId: number) => {
  const [tournament] = await db
    .select({
      id: tournaments.id,
      clubId: tournaments.clubId,
      clubHandle: clubs.handle,
      clubName: clubs.name,
      date: tournaments.date,
      season: tournaments.season,
      courseId: tournaments.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      teeId: tournaments.teeId,
    })
    .from(tournaments)
    .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
    .leftJoin(courses, eq(tournaments.courseId, courses.id))
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament) {
    return tournament;
  }

  const [
    tournamentRounds,
    tournamentRoundScores,
    tournamentGreenies,
    tournamentHoles,
    tournamentTees,
  ] =
    await Promise.all([
      db
        .select({
          id: roundSummaries.roundId,
          tournamentId: roundSummaries.tournamentId,
          teeId: rounds.teeId,
          userId: roundSummaries.userId,
          date: roundSummaries.date,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          image: users.image,
          courseId: roundSummaries.courseId,
          courseHandle: courses.handle,
          courseName: courses.name,
          courseImgUrl: courses.imgUrl,
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
        .innerJoin(users, eq(roundSummaries.userId, users.id))
        .innerJoin(courses, eq(roundSummaries.courseId, courses.id))
        .where(eq(roundSummaries.tournamentId, tournamentId))
        .orderBy(
          asc(users.lastName),
          asc(users.firstName),
          asc(users.username),
        ),
      db
        .select({
          roundId: roundScores.roundId,
          hole: roundScores.hole,
          par: courseHoles.par,
          handicap: courseHoles.handicap,
          strokes: roundScores.strokes,
          putts: roundScores.putts,
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
        .where(eq(rounds.tournamentId, tournamentId))
        .orderBy(asc(roundScores.roundId), asc(roundScores.hole)),
      db
        .select({
          roundId: greenies.roundId,
          hole: greenies.hole,
          feet: greenies.feet,
          inches: greenies.inches,
          roundDate: rounds.date,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          image: users.image,
          courseName: courses.name,
        })
        .from(greenies)
        .innerJoin(rounds, eq(greenies.roundId, rounds.id))
        .innerJoin(users, eq(rounds.userId, users.id))
        .innerJoin(courses, eq(rounds.courseId, courses.id))
        .where(eq(rounds.tournamentId, tournamentId))
        .orderBy(asc(greenies.hole), asc(greenies.feet), asc(greenies.inches)),
      db
        .select({
          hole: courseHoles.hole,
          par: courseHoles.par,
        })
        .from(courseHoles)
        .where(eq(courseHoles.courseId, tournament.courseId))
        .orderBy(asc(courseHoles.hole)),
      db
        .select({
          id: courseTees.id,
          name: courseTees.name,
          color: courseTees.color,
          rating: courseTees.rating,
          slope: courseTees.slope,
          totalYards:
            sql<number | null>`sum(${teeYardages.yards})::int`.mapWith(
              (value) => (value == null ? null : Number(value)),
            ),
        })
        .from(courseTees)
        .leftJoin(teeYardages, eq(teeYardages.teeId, courseTees.id))
        .where(eq(courseTees.courseId, tournament.courseId))
        .groupBy(
          courseTees.id,
          courseTees.name,
          courseTees.color,
          courseTees.rating,
          courseTees.slope,
          courseTees.sortOrder,
        )
        .orderBy(asc(courseTees.sortOrder), asc(courseTees.id)),
    ]);

  const scoresByRoundId = new Map<number, typeof tournamentRoundScores>();
  for (const score of tournamentRoundScores) {
    const scores = scoresByRoundId.get(score.roundId) ?? [];
    scores.push(score);
    scoresByRoundId.set(score.roundId, scores);
  }
  const greeniesByRoundId = new Map<number, typeof tournamentGreenies>();
  for (const greenie of tournamentGreenies) {
    const roundGreenies = greeniesByRoundId.get(greenie.roundId) ?? [];
    roundGreenies.push(greenie);
    greeniesByRoundId.set(greenie.roundId, roundGreenies);
  }

  const roundsWithScores = (
    await Promise.all(
      tournamentRounds.map(async (round) => {
        const priorScoreDifferentials = await getPriorClubScoreDifferentials({
          userId: round.userId,
          clubId: tournament.clubId,
          beforeDate: tournament.date,
        });
        const playerIndex = calculatePlayerIndex(priorScoreDifferentials);
        const tournamentHandicap = calculateCourseHandicap(
          playerIndex,
          round.courseSlope,
        );
        const netStrokes = calculateNetStrokes(
          round.isComplete ? round.totalStrokes : null,
          tournamentHandicap,
        );

        return {
          ...round,
          tournamentHandicap,
          playingHandicap: tournamentHandicap,
          netStrokes,
          scores: scoresByRoundId.get(round.id) ?? [],
          holes: tournamentHoles,
          tees: tournamentTees,
          greenies: greeniesByRoundId.get(round.id) ?? [],
        };
      }),
    )
  ).sort(compareTournamentRoundStandings);

  return {
    ...tournament,
    rounds: roundsWithScores,
    greenies: tournamentGreenies,
  };
});

export const getUpcomingTournamentsForUser = cache(async (userId: string) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return db
    .select({
      id: tournaments.id,
      date: tournaments.date,
      season: tournaments.season,
      clubId: tournaments.clubId,
      clubName: clubs.name,
      courseId: tournaments.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
    })
    .from(tournaments)
    .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
    .innerJoin(courses, eq(tournaments.courseId, courses.id))
    .innerJoin(
      clubMembers,
      and(
        eq(clubMembers.clubId, tournaments.clubId),
        eq(clubMembers.userId, userId),
      ),
    )
    .where(gte(tournaments.date, today))
    .orderBy(asc(tournaments.date), asc(tournaments.id));
});

export const getAddablePlayersForTournament = cache(
  async (tournamentId: number) => {
    return db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        image: users.image,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .innerJoin(tournaments, eq(tournaments.id, tournamentId))
      .leftJoin(
        rounds,
        and(
          eq(rounds.userId, users.id),
          eq(rounds.tournamentId, tournamentId),
        ),
      )
      .where(isNull(rounds.id))
      .orderBy(asc(users.firstName), asc(users.lastName), asc(users.username));
  },
);

export const getRoundsCountByTournamentId = cache(async (tournamentId: number) => {
  const [row] = await db
    .select({ value: count() })
    .from(rounds)
    .where(eq(rounds.tournamentId, tournamentId));
  return row?.value ?? 0;
});

function compareTournamentRoundStandings<
  T extends {
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    netStrokes: number | null;
    totalStrokes: number;
  },
>(a: T, b: T) {
  if (a.netStrokes == null && b.netStrokes == null) {
    return compareTournamentRoundPlayers(a, b);
  }

  if (a.netStrokes == null) return 1;
  if (b.netStrokes == null) return -1;

  const netCompare = a.netStrokes - b.netStrokes;
  if (netCompare !== 0) return netCompare;

  const grossCompare = a.totalStrokes - b.totalStrokes;
  if (grossCompare !== 0) return grossCompare;

  return compareTournamentRoundPlayers(a, b);
}

function compareTournamentRoundPlayers(
  a: {
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  },
  b: {
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  },
) {
  return (
    (a.lastName ?? "").localeCompare(b.lastName ?? "") ||
    (a.firstName ?? "").localeCompare(b.firstName ?? "") ||
    (a.username ?? "").localeCompare(b.username ?? "")
  );
}
