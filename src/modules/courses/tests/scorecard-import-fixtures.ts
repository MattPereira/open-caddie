import { beforeEach } from "vitest";

import { HOLE_COUNT } from "@/modules/courses";
import { createCourseScorecardImport } from "../server";

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
