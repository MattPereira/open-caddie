import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  courseHoles,
  courses,
  greenies,
  roundScores,
  rounds,
  users,
} from "@/db/schema";

// Per-hole scores and Greenies for a set of Rounds. Every caller reads the same
// two tables over the same joins and differs only in how it names the Rounds it
// wants, so the Round predicate is the one parameter. The columns are fixed at
// the widest shape any caller needs and each caller narrows for itself; the
// alternative — a projection parameter — recreates the divergence this replaces.
//
// Predicates are written against `rounds`, which both reads join, so a caller
// may key off `rounds.matchId`, `rounds.tournamentId` or `rounds.id`. Keying off
// a column of `rounds` rather than a list of Round ids is what lets the Match,
// Tournament and standings reads keep firing these in parallel with the query
// that fetches the Rounds themselves.

// `par` is left-joined and so nullable: a Round may hold a score for a hole its
// Course has no row for.
export function readScoresByRounds(where: SQL) {
  return db
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
    .where(where)
    .orderBy(asc(roundScores.roundId), asc(roundScores.hole));
}

// Ordered closest-first within a hole, which is the order the Tournament and
// Match Greenies tabs render. Callers that group by Round ignore it.
export function readGreeniesByRounds(where: SQL) {
  return db
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
    .where(where)
    .orderBy(asc(greenies.hole), asc(greenies.feet), asc(greenies.inches));
}

export async function readScorecardsByRounds(where: SQL) {
  const [scores, roundGreenies] = await Promise.all([
    readScoresByRounds(where),
    readGreeniesByRounds(where),
  ]);
  return { scores, greenies: roundGreenies };
}

export function groupByRoundId<T extends { roundId: number }>(rows: readonly T[]) {
  const byRoundId = new Map<number, T[]>();
  for (const row of rows) {
    const existing = byRoundId.get(row.roundId);
    if (existing) existing.push(row);
    else byRoundId.set(row.roundId, [row]);
  }
  return byRoundId;
}

export type RoundScoreRow = Awaited<
  ReturnType<typeof readScoresByRounds>
>[number];

export type RoundGreenieRow = Awaited<
  ReturnType<typeof readGreeniesByRounds>
>[number];
