import { required } from "@/lib/required";
import { createCourse, getCourseForEdit } from "@/modules/courses/server";

import { ok } from "./ok";

type CoursePlan = {
  name: string;
  handle: string;
  /** The look a generated Course image should match. */
  character: string;
  pars: number[];
  handicaps: number[];
  tees: { name: string; color: string; rating: string; slope: number }[];
};

const GULLWING_LINKS: CoursePlan = {
  name: "Gullwing Links",
  handle: "gullwing-links",
  character: "links: firm fescue, pot bunkers, dunes, grey sea",
  pars: [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 4, 5, 4, 3, 4, 4],
  handicaps: [7, 11, 15, 1, 9, 3, 17, 13, 5, 8, 16, 2, 12, 4, 14, 18, 6, 10],
  tees: [
    { name: "Blue", color: "#1d4ed8", rating: "73.2", slope: 134 },
    { name: "White", color: "#e5e7eb", rating: "70.8", slope: 128 },
    { name: "Red", color: "#dc2626", rating: "68.9", slope: 121 },
  ],
};

// Holes 1–6 shape the Four-Ball's Match Skins; change them with its cards.
const SAGUARO_RIDGE: CoursePlan = {
  name: "Saguaro Ridge",
  handle: "saguaro-ridge",
  character: "desert: cactus, red rock, waste areas, island fairways",
  pars: [4, 5, 4, 4, 3, 5, 3, 4, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5],
  handicaps: [9, 7, 13, 11, 17, 3, 15, 1, 5, 6, 12, 16, 2, 10, 8, 4, 18, 14],
  tees: [
    { name: "Black", color: "#111827", rating: "75.6", slope: 149 },
    { name: "Blue", color: "#1d4ed8", rating: "73.9", slope: 144 },
    { name: "White", color: "#e5e7eb", rating: "71.2", slope: 135 },
    { name: "Red", color: "#dc2626", rating: "69.0", slope: 124 },
  ],
};

const OAKMERE_PARK: CoursePlan = {
  name: "Oakmere Park",
  handle: "oakmere-park",
  character: "parkland: old oaks, lush fairways, a lake",
  pars: [5, 4, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 3, 4, 4, 5, 3, 4],
  handicaps: [5, 13, 1, 17, 9, 3, 11, 15, 7, 10, 2, 8, 16, 6, 12, 4, 18, 14],
  tees: [
    { name: "Blue", color: "#1d4ed8", rating: "72.8", slope: 131 },
    { name: "White", color: "#e5e7eb", rating: "70.5", slope: 125 },
  ],
};

// Long enough to wrap or truncate in course pickers and cards.
const PORT_HAVEN: CoursePlan = {
  name: "The Cliffs at Port Haven Golf & Country Club",
  handle: "port-haven",
  character: "coastal: clifftop greens, ocean carries, a lighthouse",
  pars: [4, 4, 3, 4, 4, 4, 3, 4, 5, 4, 3, 4, 4, 4, 3, 4, 4, 5],
  handicaps: [1, 9, 15, 5, 11, 3, 17, 7, 13, 2, 16, 8, 10, 4, 18, 6, 12, 14],
  tees: [
    { name: "Blue", color: "#1d4ed8", rating: "72.0", slope: 138 },
    { name: "White", color: "#e5e7eb", rating: "69.8", slope: 130 },
  ],
};

const BRACKENMOOR_HEATH: CoursePlan = {
  name: "Brackenmoor Heath",
  handle: "brackenmoor-heath",
  character: "heathland: heather, gorse, birch, sandy soil",
  pars: [4, 3, 4, 4, 5, 4, 3, 4, 4, 4, 4, 3, 4, 4, 5, 4, 3, 4],
  handicaps: [9, 17, 3, 11, 1, 7, 15, 5, 13, 6, 12, 18, 2, 14, 4, 8, 16, 10],
  tees: [
    { name: "Black", color: "#111827", rating: "71.9", slope: 133 },
    { name: "Gold", color: "#ca8a04", rating: "70.1", slope: 127 },
    { name: "Silver", color: "#9ca3af", rating: "68.4", slope: 119 },
  ],
};

// A short name, next to Port Haven's long one.
const FERN_HOLLOW: CoursePlan = {
  name: "Fern Hollow",
  handle: "fern-hollow",
  character: "mountain: pines, elevation changes, a creek",
  pars: [4, 4, 5, 3, 4, 4, 3, 4, 4, 5, 4, 3, 4, 4, 4, 3, 5, 4],
  handicaps: [11, 5, 1, 15, 7, 13, 17, 3, 9, 4, 10, 16, 8, 2, 14, 18, 6, 12],
  tees: [{ name: "Green", color: "#15803d", rating: "70.2", slope: 126 }],
};

const TEE_YARDS: Record<number, number> = { 3: 165, 4: 395, 5: 530 };

async function seedCourse(adminId: string, plan: CoursePlan) {
  ok(
    await createCourse(adminId, {
      handle: plan.handle,
      name: plan.name,
      imgUrl: "",
      tees: plan.tees.map(({ name, color, rating, slope }, t) => ({
        name,
        color,
        rating,
        slope,
        // Each tee forward plays about 25 yards shorter per hole.
        yardages: plan.pars.map(
          (par, i) => TEE_YARDS[par] + (i % 4) * 12 - t * 25,
        ),
        sortOrder: t,
      })),
      holes: plan.pars.map((par, i) => ({
        hole: i + 1,
        par,
        handicap: plan.handicaps[i],
      })),
    }),
    `course ${plan.handle}`,
  );
  const stored = required(
    await getCourseForEdit(plan.handle),
    `course ${plan.handle}`,
  );
  return {
    handle: stored.handle,
    pars: plan.pars,
    parThrees: plan.pars.flatMap((par, i) => (par === 3 ? [i + 1] : [])),
    tee: (name: string) =>
      required(
        stored.tees.find((t) => t.name === name),
        `${plan.handle} ${name} tee`,
      ).id,
  };
}
export type SeededCourse = Awaited<ReturnType<typeof seedCourse>>;

export async function seedCourses(adminId: string) {
  return {
    gullwing: await seedCourse(adminId, GULLWING_LINKS),
    saguaro: await seedCourse(adminId, SAGUARO_RIDGE),
    oakmere: await seedCourse(adminId, OAKMERE_PARK),
    portHaven: await seedCourse(adminId, PORT_HAVEN),
    brackenmoor: await seedCourse(adminId, BRACKENMOOR_HEATH),
    fernHollow: await seedCourse(adminId, FERN_HOLLOW),
  };
}
export type SeededCourses = Awaited<ReturnType<typeof seedCourses>>;
