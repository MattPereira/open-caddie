import { beforeEach } from "vitest";

import { required } from "@/lib/required";
import { HOLE_COUNT } from "@/modules/courses";
import { clearCacheMocks } from "@/test/cache-mocks";
import type { FixtureCourse, Fixtures } from "@/test/fixtures";
import { createCourseScorecardImport, getCourseForEdit } from "../server";

type ParseResult = Awaited<
  ReturnType<
    Parameters<typeof createCourseScorecardImport>[0]["parseScorecardImage"]
  >
>;
type ParsedTee = ParseResult["scorecard"]["tees"][number];

/** 18 par-4 holes, handicaps in hole order. */
export function parsedHoles() {
  return Array.from({ length: HOLE_COUNT }, (_, index) => ({
    hole: index + 1,
    par: 4,
    handicap: index + 1,
  }));
}

/** A tee of 400 yards per hole; rating and slope only if given. */
export function parsedTee(
  name: string,
  overrides: Partial<ParsedTee> = {},
): ParsedTee {
  return {
    name,
    yardages: Array.from({ length: HOLE_COUNT }, () => 400),
    ...overrides,
  };
}

export function parsedScorecard({
  tees,
  holes = parsedHoles(),
  warnings = [],
  parserModel,
}: {
  tees: ParsedTee[];
  holes?: ParseResult["scorecard"]["holes"];
  warnings?: ParseResult["warnings"];
  parserModel?: string;
}): ParseResult {
  return { scorecard: { tees, holes }, warnings, parserModel };
}

/** Scorecard Imports whose parser always reads `scorecard`. */
export function importsParsing(
  scorecard: Parameters<typeof parsedScorecard>[0],
) {
  return createCourseScorecardImport({
    async parseScorecardImage() {
      return parsedScorecard(scorecard);
    },
  });
}

/** Publishes one complete Blue tee and 18 holes without pausing. */
export const imports = importsParsing({
  tees: [parsedTee("Blue", { color: "blue", rating: 71.2, slope: 128 })],
});

export async function importedCourse(
  fixtures: Pick<Fixtures, "admin">,
  images: { scorecard: string; course?: string },
): Promise<FixtureCourse> {
  const outcome = await imports.start({
    actorId: await fixtures.admin(),
    target: { kind: "new", name: `Imported ${crypto.randomUUID()}` },
    stagedScorecardImageHandle: images.scorecard,
    stagedCourseImageHandle: images.course,
  });
  if (outcome.outcome !== "published") {
    throw new Error(`importedCourse ${JSON.stringify(outcome)}`);
  }
  const stored = required(
    await getCourseForEdit(outcome.handle),
    "imported course",
  );
  clearCacheMocks();
  return {
    id: stored.id,
    handle: stored.handle,
    name: stored.name,
    imgUrl: stored.imgUrl,
  };
}

/** Two Platform Admins and a unique tag, fresh before each test. */
export function importActors(fixtures: {
  admin: () => Promise<string>;
  player: (options: { isAdmin: boolean }) => Promise<{ id: string }>;
}) {
  const actors = { actorId: "", secondActorId: "", tag: "" };
  beforeEach(async () => {
    // Import cleanup scans every import in the database, so tests tell their
    // own staged images apart by the tag.
    actors.tag = crypto.randomUUID();
    actors.actorId = await fixtures.admin();
    actors.secondActorId = (await fixtures.player({ isAdmin: true })).id;
  });
  return actors;
}
