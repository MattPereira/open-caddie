import { cache } from "react";
import { and, asc, count, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  clubMembers,
  clubs,
  courses,
  pairingMembers,
  pairings,
  rounds,
  seasons,
  tournaments,
  users,
} from "@/db/schema";
import { eventGreenies, readTournamentRounds } from "@/lib/rounds/reads";

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
  const [[tournament], { course, rounds: tournamentRounds }] =
    await Promise.all([
      db
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
        .innerJoin(courses, eq(tournaments.courseId, courses.id))
        .where(eq(tournaments.id, tournamentId))
        .limit(1),
      readTournamentRounds(tournamentId),
    ]);

  if (!tournament) {
    return tournament;
  }

  // Tournament holes stay without handicaps until consumers branch on kind:
  // Skins and Match Play treat a hole handicap as "this is a Match Round".
  const holes = course.holes.map(({ hole, par }) => ({ hole, par }));

  return {
    ...tournament,
    rounds: tournamentRounds.map((round) => ({
      ...round,
      courseHandle: tournament.courseHandle,
      courseName: tournament.courseName,
      courseImgUrl: tournament.courseImgUrl,
      holes,
      tees: course.tees,
    })),
    greenies: eventGreenies(tournamentRounds),
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
      // Sort order carries no meaning past the ordering itself — a Pairing is
      // read by name — so it orders the rows without joining the result.
      .select({ id: pairings.id, name: pairings.name })
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
