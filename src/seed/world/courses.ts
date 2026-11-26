import { required } from "@/lib/required";
import { createCourse, getCourseForEdit } from "@/modules/courses/server";

import { ok } from "./ok";
import { COURSE_IMAGES } from "./image-data";

import { COURSE_PLANS, type CoursePlan } from "./course-data";
import type { SeededRoute } from "./routes";

async function seedCourse(adminId: string, plan: CoursePlan) {
  ok(
    await createCourse(adminId, {
      handle: plan.handle,
      name: plan.name,
      imgUrl: COURSE_IMAGES[plan.handle],
      scorecardImgUrl: `/seed/courses/${plan.handle}-scorecard.svg`,
      tees: plan.tees.map((tee, sortOrder) => ({ ...tee, sortOrder })),
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
    name: plan.name,
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
    pebbleBeach: await seedCourse(adminId, COURSE_PLANS.pebbleBeach),
    sawgrass: await seedCourse(adminId, COURSE_PLANS.sawgrass),
    kapalua: await seedCourse(adminId, COURSE_PLANS.kapalua),
    maunaKea: await seedCourse(adminId, COURSE_PLANS.maunaKea),
    bethpage: await seedCourse(adminId, COURSE_PLANS.bethpage),
    royalCountyDown: await seedCourse(adminId, COURSE_PLANS.royalCountyDown),
  };
}
export type SeededCourses = Awaited<ReturnType<typeof seedCourses>>;

export function courseRoutes(courses: SeededCourses): SeededRoute[] {
  return Object.values(courses).map((course) => ({
    path: `/courses/${course.handle}`,
    shows: `Course: ${course.name}`,
  }));
}
