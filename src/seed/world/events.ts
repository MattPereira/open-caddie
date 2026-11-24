import { addDays, format } from "date-fns";

import { required } from "@/lib/required";
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
import {
  PLAYERS,
  roundsByPlayer,
  type PlayerIds,
  type PlayerKey,
} from "./players";

/** yyyy-mm-dd, `offset` days from today. */
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
};

export async function seedTournament(
  adminId: string,
  ids: PlayerIds,
  clubHandle: string,
  plan: TournamentPlan,
) {
  const created = ok(
    await createTournament(adminId, {
      clubHandle,
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
  const roundOf = roundsByPlayer(rounds, ids);

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

  if (plan.holesScored === 0) return;
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
  const { rounds } = await getMatchRounds(required(created.id, "match id"));
  const roundOf = roundsByPlayer(rounds, ids);
  for (const [key, playerIndexOverride] of Object.entries(plan.overrides)) {
    ok(
      await changeRoundSettings(adminId, roundOf(key as PlayerKey), {
        playerIndexOverride,
      }),
      `${key}'s override`,
    );
  }
  return roundOf;
}

/** A Match with every Player's generated card, `holes` deep. */
export async function seedPlayedMatch(
  adminId: string,
  ids: PlayerIds,
  plan: MatchPlan & { salt: number; holes: number },
) {
  const roundOf = await seedMatch(adminId, ids, plan);
  for (const [index, key] of plan.players.entries()) {
    await writeScores(
      adminId,
      roundOf(key),
      firstHoles(
        scorecard(plan.course.pars, PLAYERS[key].skill, plan.salt + index),
        plan.holes,
      ),
    );
  }
  return roundOf;
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
) {
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
}
