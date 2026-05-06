import { z } from "zod";

export const UserFormSchema = z.object({
  email: z.email("Must be a valid email").max(254),
  firstName: z.string().trim().max(50),
  lastName: z.string().trim().max(50),
  username: z.string().trim().max(50),
  image: z.union([z.url("Must be a valid URL").max(2048), z.literal("")]),
  isAdmin: z.boolean(),
});

export const UserCreateSchema = UserFormSchema;
export const UserUpdateSchema = UserFormSchema.extend({
  id: z.string().min(1),
});

export type UserFormValues = z.infer<typeof UserFormSchema>;
export type UserCreateValues = z.infer<typeof UserCreateSchema>;
export type UserUpdateValues = z.infer<typeof UserUpdateSchema>;

export const TournamentFormSchema = z.object({
  clubHandle: z.string().trim().min(1, "Club is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  courseHandle: z.string().trim(),
});

export const TournamentCreateSchema = TournamentFormSchema;
export const TournamentUpdateSchema = TournamentFormSchema.extend({
  id: z.number().int().positive(),
});

export type TournamentFormValues = z.infer<typeof TournamentFormSchema>;
export type TournamentCreateValues = z.infer<typeof TournamentCreateSchema>;
export type TournamentUpdateValues = z.infer<typeof TournamentUpdateSchema>;

const intNonNeg = z
  .number({ message: "Must be a number" })
  .int("Must be a whole number")
  .nonnegative("Cannot be negative");

export const PointRulesSchema = z.object({
  participation: intNonNeg,
  pars: intNonNeg,
  birdies: intNonNeg,
  eagles: intNonNeg,
  aces: intNonNeg,
  strokes: z.object({
    positions: z
      .array(intNonNeg)
      .min(1, "At least one position is required"),
  }),
  putts: z.object({
    positions: z
      .array(intNonNeg)
      .min(1, "At least one position is required"),
  }),
  greenies: z.object({
    tiers: z
      .array(
        z.object({
          maxFt: z.number().int().nonnegative().nullable(),
          pts: intNonNeg,
        }),
      )
      .min(1, "At least one tier is required"),
  }),
});

export type PointRules = z.infer<typeof PointRulesSchema>;

export const ClubFormSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(1, "Handle is required")
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Lowercase letters, numbers, and hyphens only",
    ),
  name: z.string().trim().min(1, "Name is required").max(100),
  logo: z.union([z.url("Must be a valid URL").max(2048), z.literal("")]),
  pointRules: PointRulesSchema,
});

export const ClubCreateSchema = ClubFormSchema;
export const ClubUpdateSchema = ClubFormSchema;

export type ClubFormValues = z.infer<typeof ClubFormSchema>;
export type ClubCreateValues = z.infer<typeof ClubCreateSchema>;
export type ClubUpdateValues = z.infer<typeof ClubUpdateSchema>;

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

const holeSchema = z.object({
  hole: z.number().int().min(1).max(18),
  par: requiredInt("Par", 2, 7),
  handicap: requiredInt("Handicap", 1, 18),
});

export const CourseFormSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(1, "Handle is required")
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Lowercase letters, numbers, and hyphens only",
    ),
  name: z.string().trim().min(1, "Name is required").max(100),
  rating: ratingString,
  slope: requiredInt("Slope", 55, 155),
  imgUrl: z.union([z.url("Must be a valid URL").max(2048), z.literal("")]),
  holes: z
    .array(holeSchema)
    .length(18, "Courses must have 18 holes")
    .refine(
      (holes) => holes.every((hole, index) => hole.hole === index + 1),
      "Hole numbers must be 1 through 18",
    ),
});

export const CourseCreateSchema = CourseFormSchema;
export const CourseUpdateSchema = CourseFormSchema.extend({
  id: z.number().int().positive(),
});

export type CourseFormValues = z.input<typeof CourseFormSchema>;
export type CourseCreateValues = z.input<typeof CourseCreateSchema>;
export type CourseUpdateValues = z.input<typeof CourseUpdateSchema>;
