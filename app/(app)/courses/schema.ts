import { z } from "zod";

const teeColorSchema = z
  .string()
  .trim()
  .max(30, "Color must be 30 characters or less");

const ratingString = z
  .string()
  .trim()
  .min(1, "Rating is required")
  .regex(/^\d+(\.\d{1,2})?$/, "Use a positive number")
  .refine((value) => Number(value) > 0, "Rating must be positive");

function requiredInt(label: string, min: number, max: number) {
  const numberSchema = z
    .number({ message: `${label} is required` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be ${max} or less`);

  return z
    .union([numberSchema, z.literal("")])
    .refine((value) => value !== "", `${label} is required`)
    .pipe(numberSchema);
}

function optionalInt(label: string, min: number, max: number) {
  const numberSchema = z
    .number({ message: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be ${max} or less`);

  return z.union([numberSchema, z.literal("")]);
}

const yardageCell = optionalInt("Yardage", 50, 800);

const teeSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "Tee name is required").max(50),
  color: teeColorSchema,
  rating: ratingString,
  slope: requiredInt("Slope", 55, 155),
  yardages: z.array(yardageCell).length(18, "Tees must have 18 yardages"),
  sortOrder: z.number().int().nonnegative(),
});

const holeSchema = z.object({
  hole: z.number().int().min(1).max(18),
  par: requiredInt("Par", 2, 7),
  handicap: requiredInt("Handicap", 1, 18),
});

export const CourseFormSchema = z
  .object({
    handle: z
      .string()
      .trim()
      .min(1, "Handle is required")
      .max(50)
      .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
    name: z.string().trim().min(1, "Name is required").max(100),
    imgUrl: z.union([z.url("Must be a valid URL").max(2048), z.literal("")]),
    scorecardImgUrl: z.union([
      z.url("Must be a valid URL").max(2048),
      z.literal(""),
    ]),
    tees: z.array(teeSchema).min(1, "At least one tee is required"),
    holes: z
      .array(holeSchema)
      .length(18, "Courses must have 18 holes")
      .refine(
        (holes) => holes.every((hole, index) => hole.hole === index + 1),
        "Hole numbers must be 1 through 18",
      )
      .refine((holes) => {
        const handicaps = holes
          .map((h) => h.handicap)
          .filter((v): v is number => typeof v === "number");
        if (handicaps.length !== 18) return true;
        const sorted = [...handicaps].sort((a, b) => a - b);
        return sorted.every((v, i) => v === i + 1);
      }, "Handicap values must be 1 through 18 with no duplicates"),
  })
  .refine(
    (data) => {
      const names = data.tees.map((t) => t.name.trim().toLowerCase());
      return new Set(names).size === names.length;
    },
    { message: "Tee names must be unique", path: ["tees"] },
  );

export const CourseUpdateSchema = z.intersection(
  CourseFormSchema,
  z.object({ id: z.number().int().positive() }),
);

// Minimal payload for the optimistic create flow: user supplies a name and
// two images; the server slugifies the handle and parses the scorecard to
// produce tees + holes.
export const CourseCreateInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  imgUrl: z.url("Course image is required").max(2048),
  scorecardImgUrl: z.url("Scorecard image is required").max(2048),
});

// Resubmit payload when the parser came back without rating/slope on one or
// more tees. The client fills in the missing values and round-trips the
// already-parsed scorecard so the server skips re-parsing.
const finalizedTeeSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().trim().max(30).optional(),
  rating: z.number().positive(),
  slope: z.number().int().min(55).max(155),
  yardages: z.array(z.number().int()).length(18),
});

export const FinalizedScorecardSchema = z.object({
  tees: z.array(finalizedTeeSchema).min(1),
  holes: z
    .array(
      z.object({
        hole: z.number().int().min(1).max(18),
        par: z.number().int().min(2).max(7),
        handicap: z.number().int().min(1).max(18),
      }),
    )
    .length(18),
});

export const CourseCreateFinalizeSchema = CourseCreateInputSchema.extend({
  scorecardData: FinalizedScorecardSchema,
});

export type CourseFormValues = z.input<typeof CourseFormSchema>;
export type CourseUpdateValues = z.input<typeof CourseUpdateSchema>;
export type CourseCreateInputValues = z.input<typeof CourseCreateInputSchema>;
export type CourseCreateFinalizeValues = z.input<
  typeof CourseCreateFinalizeSchema
>;
export type FinalizedScorecard = z.infer<typeof FinalizedScorecardSchema>;
export type TeeFormValues = z.input<typeof teeSchema>;
