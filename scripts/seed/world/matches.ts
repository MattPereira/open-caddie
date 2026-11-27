import { changeRoundSettings } from "@/modules/rounds/server";

import { writeGreenie, writeScores } from "./cards";
import type { SeededCourses } from "./courses";
import {
  dateFromToday,
  matchRoute,
  seedMatch,
  seedPlayedMatch,
  type MatchPlan,
} from "./events";
import { ok } from "./ok";
import type { PlayerIds, PlayerKey } from "./players";
import { scoringProgress, type SeededRoute } from "./routes";

export async function seedMatches(
  adminId: string,
  ids: PlayerIds,
  courses: SeededCourses,
): Promise<SeededRoute[]> {
  const {
    pebbleBeach,
    sawgrass,
    kapalua,
    maunaKea,
    bethpage,
    royalCountyDown,
  } = courses;
  const routes: SeededRoute[] = [];
  const played = async (
    plan: MatchPlan & { salt: number; holes: number },
    note?: string,
  ) => {
    const seeded = await seedPlayedMatch(adminId, ids, plan);
    routes.push(
      matchRoute(seeded.matchId, plan, scoringProgress(plan.holes), note),
    );
    return seeded;
  };

  await played({
    creator: "rory",
    format: "singles_match_play",
    date: dateFromToday(-100),
    course: kapalua,
    tee: "Regular",
    players: ["rory", "jordan"],
    overrides: { rory: 9.6, jordan: 15.2 },
    salt: 510,
    holes: 18,
  });
  await played({
    creator: "john",
    format: "singles_match_play",
    date: dateFromToday(-7),
    course: pebbleBeach,
    tee: "Blue",
    players: ["john", "dustin"],
    overrides: { john: 4.2, dustin: 13.8 },
    salt: 520,
    holes: 18,
  });
  await played(
    {
      creator: "tyson",
      format: "three_ball_match_play",
      date: dateFromToday(-60),
      course: royalCountyDown,
      tee: "White",
      players: ["scottie", "tyson", "bubba"],
      overrides: { scottie: -0.8, tyson: 7.5, bubba: 16.4 },
      salt: 530,
      holes: 18,
    },
    "Scottie plays off a plus index",
  );
  await played({
    creator: "vijay",
    format: "four_ball_match_play",
    date: dateFromToday(-45),
    course: bethpage,
    tee: "Blue",
    players: ["vijay", "max", "rivers", "tyson"],
    teams: [
      ["vijay", "max"],
      ["rivers", "tyson"],
    ],
    overrides: { vijay: 18.5, max: 24.1, rivers: 8.9, tyson: 7.2 },
    salt: 540,
    holes: 18,
  });

  const threeBall = await played(
    {
      creator: "justin",
      format: "three_ball_match_play",
      date: dateFromToday(-2),
      course: maunaKea,
      tee: "Tournament",
      players: ["justin", "john", "collin"],
      overrides: { justin: 12.3, john: -1.2 },
      salt: 550,
      holes: 9,
    },
    "Collin has no Player Index Override and plays another tee",
  );
  ok(
    await changeRoundSettings(adminId, threeBall.roundOf("collin"), {
      teeId: maunaKea.tee("Resort"),
    }),
    "Collin's tee",
  );
  routes.push({
    path: `/rounds/${threeBall.roundOf("justin")}/play`,
    shows: "play page for Justin's Round in that Three-Ball Match",
  });

  // Arnold sets it up but doesn't play. Phil's birdie on 2 takes the skin
  // carried from hole 1, holes 3–5 tie and carry, and Rickie's birdie on 6
  // takes all 4. Rickie makes a gross bogey on 5 to tie after his stroke.
  const fourBallPlan: MatchPlan = {
    creator: "arnold",
    format: "four_ball_match_play",
    date: dateFromToday(0),
    course: sawgrass,
    tee: "Blue",
    players: ["phil", "jon", "jordan", "rickie"],
    teams: [
      ["phil", "jon"],
      ["jordan", "rickie"],
    ],
    overrides: { phil: 10, jon: 11.2, jordan: 10.6, rickie: 12.1 },
  };
  const fourBall = await seedMatch(adminId, ids, fourBallPlan);
  const fourBallCards: Partial<Record<PlayerKey, number[]>> = {
    phil: [4, 4, 3, 4, 4, 4],
    jon: [4, 5, 3, 4, 4, 5],
    jordan: [4, 5, 3, 4, 4, 4],
    rickie: [4, 5, 3, 4, 5, 3],
  };
  for (const [key, strokes] of Object.entries(fourBallCards)) {
    await writeScores(
      adminId,
      fourBall.roundOf(key as PlayerKey),
      strokes.map((s) => ({ strokes: s, putts: Math.min(2, s - 1) })),
    );
  }
  await writeGreenie(adminId, fourBall.roundOf("phil"), sawgrass.parThrees[0], {
    feet: 6,
    inches: 2,
  });
  const fourBallRoute = matchRoute(
    fourBall.matchId,
    fourBallPlan,
    scoringProgress(6),
    "Arnold created it but doesn't play",
  );
  routes.push(
    fourBallRoute,
    {
      path: `${fourBallRoute.path}?tab=skins`,
      shows: "its Match Skins: holes 3–5 carry, Rickie's birdie on 6 takes 4",
    },
    {
      path: `/rounds/${fourBall.roundOf("phil")}/play`,
      shows: "play page for Phil's Round in that Four-Ball Match",
    },
  );
  return routes;
}
