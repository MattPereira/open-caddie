import { changeRoundSettings } from "@/modules/rounds/server";

import { writeGreenie, writeScores } from "./cards";
import type { SeededCourses } from "./courses";
import { dateFromToday, seedMatch, seedPlayedMatch } from "./events";
import { ok } from "./ok";
import type { PlayerIds, PlayerKey } from "./players";

export async function seedMatches(
  adminId: string,
  ids: PlayerIds,
  courses: SeededCourses,
) {
  const { gullwing, saguaro, oakmere, portHaven, brackenmoor, fernHollow } =
    courses;

  await seedPlayedMatch(adminId, ids, {
    creator: "priya",
    format: "singles_match_play",
    date: dateFromToday(-100),
    course: oakmere,
    tee: "Blue",
    players: ["priya", "felix"],
    overrides: { priya: 9.6, felix: 15.2 },
    salt: 510,
    holes: 18,
  });
  await seedPlayedMatch(adminId, ids, {
    creator: "marcus",
    format: "singles_match_play",
    date: dateFromToday(-7),
    course: gullwing,
    tee: "Blue",
    players: ["marcus", "tomas"],
    overrides: { marcus: 4.2, tomas: 13.8 },
    salt: 520,
    holes: 18,
  });
  // Kenji's is a plus index.
  await seedPlayedMatch(adminId, ids, {
    creator: "bram",
    format: "three_ball_match_play",
    date: dateFromToday(-60),
    course: fernHollow,
    tee: "Green",
    players: ["kenji", "bram", "zoe"],
    overrides: { kenji: -0.8, bram: 7.5, zoe: 16.4 },
    salt: 530,
    holes: 18,
  });
  await seedPlayedMatch(adminId, ids, {
    creator: "siobhan",
    format: "four_ball_match_play",
    date: dateFromToday(-45),
    course: brackenmoor,
    tee: "Black",
    players: ["siobhan", "leo", "jules", "bram"],
    teams: [
      ["siobhan", "leo"],
      ["jules", "bram"],
    ],
    overrides: { siobhan: 18.5, leo: 24.1, jules: 8.9, bram: 7.2 },
    salt: 540,
    holes: 18,
  });

  // Wilhelmina has no override and plays the White tee.
  const threeBall = await seedPlayedMatch(adminId, ids, {
    creator: "hannah",
    format: "three_ball_match_play",
    date: dateFromToday(-2),
    course: portHaven,
    tee: "Blue",
    players: ["hannah", "marcus", "wilhelmina"],
    overrides: { hannah: 12.3, marcus: -1.2 },
    salt: 550,
    holes: 9,
  });
  ok(
    await changeRoundSettings(adminId, threeBall("wilhelmina"), {
      teeId: portHaven.tee("White"),
    }),
    "Wilhelmina's tee",
  );

  // Rosa sets it up but doesn't play. Noor's birdie on 2 takes the skin
  // carried from hole 1, holes 3–5 tie and carry, and Maya's birdie on 6
  // (net 3, with a stroke there) takes all 4.
  const fourBall = await seedMatch(adminId, ids, {
    creator: "rosa",
    format: "four_ball_match_play",
    date: dateFromToday(0),
    course: saguaro,
    tee: "Blue",
    players: ["noor", "grace", "felix", "maya"],
    teams: [
      ["noor", "grace"],
      ["felix", "maya"],
    ],
    overrides: { noor: 10, grace: 11.2, felix: 10.6, maya: 12.1 },
  });
  const fourBallCards: Partial<Record<PlayerKey, number[]>> = {
    noor: [4, 4, 4, 4, 3, 5],
    grace: [4, 5, 4, 4, 3, 6],
    felix: [4, 5, 4, 4, 3, 5],
    maya: [4, 5, 4, 4, 3, 4],
  };
  for (const [key, strokes] of Object.entries(fourBallCards)) {
    await writeScores(
      adminId,
      fourBall(key as PlayerKey),
      strokes.map((s) => ({ strokes: s, putts: Math.min(2, s - 1) })),
    );
  }
  await writeGreenie(adminId, fourBall("noor"), saguaro.parThrees[0], {
    feet: 6,
    inches: 2,
  });
}
