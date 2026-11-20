import { createCourseScorecardImport } from "../server";

/** Publishes one complete Blue tee and 18 holes without pausing. */
export const imports = createCourseScorecardImport({
  async parseScorecardImage() {
    return {
      scorecard: {
        tees: [
          {
            name: "Blue",
            color: "blue",
            rating: 71.2,
            slope: 128,
            yardages: Array.from({ length: 18 }, () => 400),
          },
        ],
        holes: Array.from({ length: 18 }, (_, index) => ({
          hole: index + 1,
          par: 4,
          handicap: index + 1,
        })),
      },
      warnings: [],
    };
  },
});
