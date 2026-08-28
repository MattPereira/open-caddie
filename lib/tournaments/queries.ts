import { cache } from "react";
import { and, asc, count, desc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clubMembers,
  clubs,
  courseHoles,
  courseTees,
  courses,
  greenies,
  pairingMembers,
  pairings,
  roundScores,
  roundSummaries,
  rounds,
  seasons,
  teeYardages,
  tournaments,
  users,
} from "@/db/schema";
import { assessHandicap } from "@/lib/handicap";
import { getPriorClubScoreDifferentials } from "@/lib/rounds/queries";

export const getAllTournaments = cache(async () => {
  return db
    .select({
      id: tournaments.id,
      clubId: seasons.clubId,
      clubHandle: clubs.handle,
      clubName: clubs.name,
      date: tournaments.date,
      season: seasons.number,
      seasonId: seasons.id,
      courseId: tournaments.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      playerCount: count(rounds.id).mapWith(Number),
    })
    .from(tournaments)
    .innerJoin(seasons, eq(tournaments.seasonId, seasons.id))
    .innerJoin(clubs, eq(seasons.clubId, clubs.id))
    .leftJoin(courses, eq(tournaments.courseId, courses.id))
    .leftJoin(rounds, eq(rounds.tournamentId, tournaments.id))
    .groupBy(tournaments.id, seasons.id, clubs.handle, clubs.name, courses.handle, courses.name, courses.imgUrl)
    .orderBy(desc(tournaments.date), desc(tournaments.id));
});

export const getTournamentsByClubHandle = cache(async (clubHandle: string) => {
  return db
    .select({
      id: tournaments.id,
      clubId: seasons.clubId,
      clubHandle: clubs.handle,
      clubName: clubs.name,
      date: tournaments.date,
      season: seasons.number,
      seasonId: seasons.id,
      courseId: tournaments.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      playerCount: count(rounds.id).mapWith(Number),
    })
    .from(tournaments)
    .innerJoin(seasons, eq(tournaments.seasonId, seasons.id))
    .innerJoin(clubs, eq(seasons.clubId, clubs.id))
    .leftJoin(courses, eq(tournaments.courseId, courses.id))
    .leftJoin(rounds, eq(rounds.tournamentId, tournaments.id))
    .where(eq(clubs.handle, clubHandle))
    .groupBy(tournaments.id, seasons.id, clubs.handle, clubs.name, courses.handle, courses.name, courses.imgUrl)
    .orderBy(desc(tournaments.date), desc(tournaments.id));
});

export const getTournamentById = cache(async (tournamentId: number) => {
  const [tournament] = await db
    .select({
      id: tournaments.id,
      clubId: seasons.clubId,
      clubHandle: clubs.handle,
      clubName: clubs.name,
      date: tournaments.date,
      season: seasons.number,
      seasonId: seasons.id,
      courseId: tournaments.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      teeId: tournaments.teeId,
    })
    .from(tournaments)
    .innerJoin(seasons, eq(tournaments.seasonId, seasons.id))
    .innerJoin(clubs, eq(seasons.clubId, clubs.id))
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
        const { courseHandicap, netStrokes } = assessHandicap({
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
          playingHandicap: courseHandicap,
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
      season: seasons.number,
      clubId: seasons.clubId,
      clubName: clubs.name,
      courseId: tournaments.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
    })
    .from(tournaments)
    .innerJoin(seasons, eq(tournaments.seasonId, seasons.id))
    .innerJoin(clubs, eq(seasons.clubId, clubs.id))
    .innerJoin(courses, eq(tournaments.courseId, courses.id))
    .innerJoin(
      clubMembers,
      and(
        eq(clubMembers.clubId, seasons.clubId),
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

// Every Tournament Round with the Pairing it belongs to, if any. Both Pairing
// reads below start here so a Round can never be missing from one and present
// in the other: cached, the two share one result within a render, so a Round
// cannot land in both or neither. The Pairing is kept beside the player rather
// than on it — which Pairing a Round sits in is the caller's context, not part
// of the player.
const getTournamentRoundPlayers = cache(async (tournamentId: number) => {
  return db
    .select({
      pairingId: pairingMembers.pairingId,
      player: {
        roundId: rounds.id,
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        image: users.image,
      },
    })
    .from(rounds)
    .innerJoin(users, eq(users.id, rounds.userId))
    .leftJoin(pairingMembers, eq(pairingMembers.roundId, rounds.id))
    .where(eq(rounds.tournamentId, tournamentId))
    .orderBy(asc(users.firstName), asc(users.lastName), asc(users.username));
});

export const getPairingsForTournament = cache(async (tournamentId: number) => {
  const [pairingRows, rows] = await Promise.all([
    db
      .select({
        id: pairings.id,
        name: pairings.name,
        sortOrder: pairings.sortOrder,
      })
      .from(pairings)
      .where(eq(pairings.tournamentId, tournamentId))
      .orderBy(asc(pairings.sortOrder), asc(pairings.id)),
    getTournamentRoundPlayers(tournamentId),
  ]);

  return pairingRows.map((pairing) => ({
    ...pairing,
    members: rows
      .filter((row) => row.pairingId === pairing.id)
      .map((row) => row.player),
  }));
});

// A Round is unassigned until an admin puts it in a Pairing: a player added to
// the Tournament after grouping is never auto-filled into a Pairing with room,
// because that would silently grant write access between unpaired players.
export const getUnassignedRoundsForTournament = cache(
  async (tournamentId: number) => {
    const rows = await getTournamentRoundPlayers(tournamentId);
    return rows
      .filter((row) => row.pairingId == null)
      .map((row) => row.player);
  },
);

export type TournamentPairing = Awaited<
  ReturnType<typeof getPairingsForTournament>
>[number];

export type TournamentPairingMember = TournamentPairing["members"][number];

// The pairing-mates of one Round, with what they have already entered — the
// play form's peer picker and its score columns, in one read. Deliberately not
// folded into the cached Tournament-by-id read: that read serves the club
// standings and Tournament pages, which would pay for a join only this form
// needs.
export const getPairingMatesForRound = cache(async (roundId: number) => {
  const [membership] = await db
    .select({ pairingId: pairingMembers.pairingId })
    .from(pairingMembers)
    .where(eq(pairingMembers.roundId, roundId))
    .limit(1);

  if (!membership) return [];

  const mates = await db
    .select({
      roundId: rounds.id,
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(pairingMembers)
    .innerJoin(rounds, eq(rounds.id, pairingMembers.roundId))
    .innerJoin(users, eq(users.id, rounds.userId))
    .where(
      and(
        eq(pairingMembers.pairingId, membership.pairingId),
        ne(pairingMembers.roundId, roundId),
      ),
    )
    .orderBy(asc(users.lastName), asc(users.firstName), asc(users.username));

  if (mates.length === 0) return [];

  const mateRoundIds = mates.map((mate) => mate.roundId);
  const [scoreRows, greenieRows] = await Promise.all([
    db
      .select({
        roundId: roundScores.roundId,
        hole: roundScores.hole,
        par: courseHoles.par,
        strokes: roundScores.strokes,
        putts: roundScores.putts,
      })
      .from(roundScores)
      .innerJoin(rounds, eq(rounds.id, roundScores.roundId))
      .leftJoin(
        courseHoles,
        and(
          eq(courseHoles.courseId, rounds.courseId),
          eq(courseHoles.hole, roundScores.hole),
        ),
      )
      .where(inArray(roundScores.roundId, mateRoundIds))
      .orderBy(asc(roundScores.roundId), asc(roundScores.hole)),
    db
      .select({
        roundId: greenies.roundId,
        hole: greenies.hole,
        feet: greenies.feet,
        inches: greenies.inches,
      })
      .from(greenies)
      .where(inArray(greenies.roundId, mateRoundIds))
      .orderBy(asc(greenies.roundId), asc(greenies.hole)),
  ]);

  return mates.map((mate) => ({
    ...mate,
    scores: scoreRows
      .filter((score) => score.roundId === mate.roundId)
      .map(({ hole, par, strokes, putts }) => ({ hole, par, strokes, putts })),
    greenies: greenieRows
      .filter((greenie) => greenie.roundId === mate.roundId)
      .map(({ hole, feet, inches }) => ({ hole, feet, inches })),
  }));
});

export type PairingMate = Awaited<
  ReturnType<typeof getPairingMatesForRound>
>[number];
