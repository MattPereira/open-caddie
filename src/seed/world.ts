import {
  createFirstPlatformAdmin,
  getAllPlayers,
} from "@/modules/players/server";

import { seedHandicapHustlers, seedMulliganMafia } from "./world/clubs";
import { courseRoutes, seedCourses } from "./world/courses";
import { dateFromToday, seedCasualRound } from "./world/events";
import { seedMatches } from "./world/matches";
import { ok } from "./world/ok";
import { seedPlayers } from "./world/players";
import type { SeededRoute } from "./world/routes";

// Fictional amateurs and societies play real courses. Dates follow today so
// upcoming, live and completed Events are always available to render.

export async function seedWorld(): Promise<SeededRoute[]> {
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

  return [
    ...(await seedMulliganMafia(adminId, ids, courses)),
    ...(await seedHandicapHustlers(adminId, ids, courses)),
    ...(await seedMatches(adminId, ids, courses)),
    await seedCasualRound(adminId, ids, {
      player: "jack",
      course: courses.royalCountyDown,
      tee: "White",
      date: dateFromToday(-5),
      salt: 710,
    }),
    await seedCasualRound(adminId, ids, {
      player: "jon",
      course: courses.sawgrass,
      tee: "Green",
      date: dateFromToday(-20),
      salt: 720,
    }),
    ...courseRoutes(courses),
  ];
}
