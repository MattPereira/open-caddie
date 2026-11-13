import { cache } from "react";
import { asc, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  courses,
  matches,
  matchTeamMembers,
  matchTeams,
  rounds,
  users,
} from "@/db/schema";
import { eventGreenies, readMatchRounds } from "@/lib/rounds/reads";

export const getAllMatches = cache(async () => {
  return db
    .select({
      id: matches.id,
      createdByPlayerId: matches.createdByPlayerId,
      creatorFirstName: users.firstName,
      creatorLastName: users.lastName,
      creatorUsername: users.username,
      date: matches.date,
      format: matches.format,
      courseId: matches.courseId,
      courseHandle: courses.handle,
      courseName: courses.name,
      courseImgUrl: courses.imgUrl,
      playerCount: count(rounds.id).mapWith(Number),
    })
    .from(matches)
    .innerJoin(users, eq(matches.createdByPlayerId, users.id))
    .innerJoin(courses, eq(matches.courseId, courses.id))
    .leftJoin(rounds, eq(rounds.matchId, matches.id))
    .groupBy(
      matches.id,
      users.firstName,
      users.lastName,
      users.username,
      courses.handle,
      courses.name,
      courses.imgUrl,
    )
    .orderBy(desc(matches.date), desc(matches.id));
});

export const getMatchById = cache(async (matchId: number) => {
  const [[match], { course, rounds: matchRounds }, matchTeamRows] =
    await Promise.all([
      db
        .select({
          id: matches.id,
          createdByPlayerId: matches.createdByPlayerId,
          creatorFirstName: users.firstName,
          creatorLastName: users.lastName,
          creatorUsername: users.username,
          date: matches.date,
          format: matches.format,
          courseId: matches.courseId,
          courseHandle: courses.handle,
          courseName: courses.name,
          courseImgUrl: courses.imgUrl,
        })
        .from(matches)
        .innerJoin(users, eq(matches.createdByPlayerId, users.id))
        .innerJoin(courses, eq(matches.courseId, courses.id))
        .where(eq(matches.id, matchId))
        .limit(1),
      readMatchRounds(matchId),
      db
        .select({
          id: matchTeams.id,
          matchId: matchTeams.matchId,
          name: matchTeams.name,
          sortOrder: matchTeams.sortOrder,
          roundId: matchTeamMembers.roundId,
        })
        .from(matchTeams)
        .leftJoin(
          matchTeamMembers,
          eq(matchTeamMembers.matchTeamId, matchTeams.id),
        )
        .where(eq(matchTeams.matchId, matchId))
        .orderBy(asc(matchTeams.sortOrder), asc(matchTeams.id)),
    ]);

  if (!match) return match;

  const roundsById = new Map(matchRounds.map((round) => [round.id, round]));
  const teams = matchTeamRows.reduce<
    {
      id: number;
      matchId: number;
      name: string;
      sortOrder: number;
      rounds: typeof matchRounds;
    }[]
  >((acc, row) => {
    let team = acc.find((candidate) => candidate.id === row.id);

    if (!team) {
      team = {
        id: row.id,
        matchId: row.matchId,
        name: row.name,
        sortOrder: row.sortOrder,
        rounds: [],
      };
      acc.push(team);
    }

    const round = row.roundId == null ? null : roundsById.get(row.roundId);
    if (round) team.rounds.push(round);

    return acc;
  }, []);

  return {
    ...match,
    course,
    rounds: matchRounds,
    teams,
    greenies: eventGreenies(matchRounds),
  };
});
