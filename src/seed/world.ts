import {
  createFirstPlatformAdmin,
  getAllPlayers,
} from "@/modules/players/server";

import { seedDawnPatrol, seedSaturdayClub } from "./world/clubs";
import { seedCourses } from "./world/courses";
import { dateFromToday, seedCasualRound } from "./world/events";
import { seedMatches } from "./world/matches";
import { ok } from "./world/ok";
import { seedPlayers } from "./world/players";

// A fixed, fictional world for agents to render. Content is the same every
// run; ids are whatever the database hands out, and dates follow the day it
// runs so "upcoming" and "past" both have something in them. Every Player,
// Course and Club is made up, so generated photos of them can't be mistaken
// for real people or places.

export async function seedWorld() {
  if ((await getAllPlayers()).length > 0) {
    throw new Error(
      "Refusing to seed: the database already has Players. Seed an empty, migrated database.",
    );
  }

  const adminId = ok(
    await createFirstPlatformAdmin({
      email: "admin@example.com",
      firstName: "Pat",
      lastName: "Admin",
    }),
    "Platform Admin",
  ).id;
  const ids = await seedPlayers(adminId);

  const courses = await seedCourses(adminId);

  await seedSaturdayClub(adminId, ids, courses);
  await seedDawnPatrol(adminId, ids, courses);
  await seedMatches(adminId, ids, courses);

  await seedCasualRound(adminId, ids, {
    player: "dev",
    course: courses.fernHollow,
    tee: "Green",
    date: dateFromToday(-5),
    salt: 710,
  });
  await seedCasualRound(adminId, ids, {
    player: "grace",
    course: courses.saguaro,
    tee: "Red",
    date: dateFromToday(-20),
    salt: 720,
  });
}
