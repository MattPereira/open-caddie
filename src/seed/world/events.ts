import { addDays, format } from "date-fns";

import { required } from "@/lib/required";
import { matchFormatLabel } from "@/modules/matches";
import { createMatch, type MatchCreateInput } from "@/modules/matches/server";
import {
  changeRoundSettings,
  createRound,
  getMatchRounds,
  getTournamentRounds,
} from "@/modules/rounds/server";
import {
  addPlayersToTournament,
  assignRoundToPairing,
  createPairing,
  createTournament,
} from "@/modules/tournaments/server";

import {
  firstHoles,
  scorecard,
  writeGreenie,
  writeScores,
  type Distance,
  type HoleScore,
} from "./cards";
import type { SeededCourse } from "./courses";
import { ok } from "./ok";
import { PLAYERS, roundIdOf, type PlayerIds, type PlayerKey } from "./players";
import { scoringProgress, type SeededRoute } from "./routes";

export function dateFromToday(offset: number) {
  return format(addDays(new Date(), offset), "yyyy-MM-dd");
}

export type TournamentPlan = {
  date: string;
  course: SeededCourse;
  tee: string;
  startNextSeason?: boolean;
  pairings: PlayerKey[][];
  /** 0 leaves the cards empty. */
  holesScored: number;
  salt: number;
  /** Replaces a Player's generated card. */
  cards?: Partial<Record<PlayerKey, HoleScore[]>>;
  /** Scores that replace single holes of a generated card. */
  holes?: { player: PlayerKey; hole: number; score: HoleScore }[];
  greenies?: { player: PlayerKey; hole: number; distance: Distance }[];
  /** What makes it worth opening, for the seeded routes list. */
  note?: string;
};

function withNote(base: string, note: string | undefined) {
  return note ? `${base}. ${note}` : base;
}

export async function seedTournament(
  adminId: string,
  ids: PlayerIds,
  club: { handle: string; name: string },
  plan: TournamentPlan,
): Promise<SeededRoute[]> {
  const created = ok(
    await createTournament(adminId, {
      clubHandle: club.handle,
      date: plan.date,
      courseHandle: plan.course.handle,
      teeId: plan.course.tee(plan.tee),
      seasonId: null,
      startNextSeason: plan.startNextSeason ?? false,
    }),
    `tournament on ${plan.date}`,
  );
  const tournamentId = required(created.id, "tournament id");
  const entrants = plan.pairings.flat();
  ok(
    await addPlayersToTournament(adminId, {
      tournamentId,
      playerIds: entrants.map((key) => ids[key]),
    }),
    "tournament players",
  );
  const { rounds } = await getTournamentRounds(tournamentId);
  const roundOf = roundIdOf(rounds, ids);

  for (const group of plan.pairings) {
    const pairing = ok(
      await createPairing(adminId, { tournamentId }),
      "pairing",
    );
    for (const key of group) {
      ok(
        await assignRoundToPairing(adminId, {
          pairingId: required(pairing.id, "pairing id"),
          roundId: roundOf(key),
        }),
        "pairing member",
      );
    }
  }

  const firstEntrant = entrants[0];
  const routes: SeededRoute[] = [
    {
      path: `/tournaments/${tournamentId}`,
      shows: withNote(
        `${club.name} Tournament at ${plan.course.name}, ${plan.date}, ${scoringProgress(plan.holesScored)}`,
        plan.note,
      ),
    },
  ];
  if (plan.holesScored < 18) {
    routes.push({
      path: `/rounds/${roundOf(firstEntrant)}/play`,
      shows: `play page for ${PLAYERS[firstEntrant].firstName}'s Round in that Tournament`,
    });
  }

  if (plan.holesScored === 0) return routes;
  for (const [index, key] of entrants.entries()) {
    const full =
      plan.cards?.[key] ??
      scorecard(plan.course.pars, PLAYERS[key].skill, plan.salt * 100 + index);
    const card = firstHoles(full, plan.holesScored);
    for (const edit of plan.holes ?? []) {
      if (edit.player === key) card[edit.hole - 1] = edit.score;
    }
    await writeScores(adminId, roundOf(key), card);
  }
  for (const greenie of plan.greenies ?? []) {
    await writeGreenie(
      adminId,
      roundOf(greenie.player),
      greenie.hole,
      greenie.distance,
    );
  }
  return routes;
}

export type MatchPlan = {
  creator: PlayerKey;
  format: MatchCreateInput["format"];
  date: string;
  course: SeededCourse;
  tee: string;
  players: PlayerKey[];
  teams?: [PlayerKey[], PlayerKey[]];
  /** Missing means the Round has no Player Index Override. */
  overrides: Partial<Record<PlayerKey, number>>;
};

export function matchRoute(
  matchId: number,
  plan: MatchPlan,
  progress: string,
  note?: string,
): SeededRoute {
  const names = plan.players.map((key) => PLAYERS[key].firstName).join(", ");
  return {
    path: `/matches/${matchId}`,
    shows: withNote(
      `${matchFormatLabel(plan.format)} Match at ${plan.course.name}, ${plan.date}, ${progress}: ${names}`,
      note,
    ),
  };
}

export async function seedMatch(
  adminId: string,
  ids: PlayerIds,
  plan: MatchPlan,
) {
  const [teamOne, teamTwo] = plan.teams ?? [[], []];
  const created = ok(
    await createMatch(ids[plan.creator], {
      date: plan.date,
      courseHandle: plan.course.handle,
      format: plan.format,
      teeId: plan.course.tee(plan.tee),
      playerIds: plan.players.map((key) => ids[key]),
      teamOnePlayerIds: teamOne.map((key) => ids[key]),
      teamTwoPlayerIds: teamTwo.map((key) => ids[key]),
    }),
    `${plan.format} match`,
  );
  const matchId = required(created.id, "match id");
  const { rounds } = await getMatchRounds(matchId);
  const roundOf = roundIdOf(rounds, ids);
  for (const [key, playerIndexOverride] of Object.entries(plan.overrides)) {
    ok(
      await changeRoundSettings(adminId, roundOf(key as PlayerKey), {
        playerIndexOverride,
      }),
      `${key}'s override`,
    );
  }
  return { matchId, roundOf };
}

/** A Match with every Player's generated card, `holes` deep. */
export async function seedPlayedMatch(
  adminId: string,
  ids: PlayerIds,
  plan: MatchPlan & { salt: number; holes: number },
) {
  const seeded = await seedMatch(adminId, ids, plan);
  for (const [index, key] of plan.players.entries()) {
    await writeScores(
      adminId,
      seeded.roundOf(key),
      firstHoles(
        scorecard(plan.course.pars, PLAYERS[key].skill, plan.salt + index),
        plan.holes,
      ),
    );
  }
  return seeded;
}

export async function seedCasualRound(
  adminId: string,
  ids: PlayerIds,
  plan: {
    player: PlayerKey;
    course: SeededCourse;
    tee: string;
    date: string;
    salt: number;
  },
): Promise<SeededRoute> {
  const { roundId } = ok(
    await createRound(ids[plan.player], {
      courseHandle: plan.course.handle,
      date: plan.date,
      tournamentId: null,
      teeId: plan.course.tee(plan.tee),
    }),
    `${plan.player}'s casual round`,
  );
  await writeScores(
    adminId,
    roundId,
    scorecard(plan.course.pars, PLAYERS[plan.player].skill, plan.salt),
  );
  return {
    path: `/rounds/${roundId}`,
    shows: `${PLAYERS[plan.player].firstName}'s casual Round at ${plan.course.name}, ${plan.date}, completed`,
  };
}
