import { z } from "zod";

export const RoundConfigSchema = z.object({
  courseHandle: z.string().trim().min(1, "Course is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  tournamentId: z.number().int().positive().nullable(),
  teeId: z.number().int().positive().nullable(),
});

export type RoundConfigValues = z.infer<typeof RoundConfigSchema>;

export const RoundScoreSchema = z.object({
  roundId: z.number().int().positive(),
  hole: z.number().int().min(1).max(18),
  strokes: z.number().int().min(1).nullable(),
  putts: z.number().int().min(0).nullable(),
});

export type RoundScoreValues = z.infer<typeof RoundScoreSchema>;

export const RoundGreenieSchema = z.object({
  roundId: z.number().int().positive(),
  hole: z.number().int().min(1).max(18),
  feet: z.number().int().min(0),
  inches: z.number().int().min(0).max(11),
});

export type RoundGreenieValues = z.infer<typeof RoundGreenieSchema>;

export const RoundGreenieDeleteSchema = RoundGreenieSchema.pick({
  roundId: true,
  hole: true,
});

export type RoundGreenieDeleteValues = z.infer<
  typeof RoundGreenieDeleteSchema
>;

function optionalInt(label: string, min: number, max?: number) {
  const numberSchema = z
    .number({ message: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`);

  return z.union([
    max == null
      ? numberSchema
      : numberSchema.max(max, `${label} must be ${max} or less`),
    z.literal(""),
  ]);
}

const optionalHandicapIndex = z
  .union([
    z
      .number({ message: "Handicap index must be a number" })
      .min(-10, "Handicap index must be at least -10.0")
      .max(54, "Handicap index must be 54.0 or less"),
    z.literal(""),
  ])
  .superRefine((value, ctx) => {
    if (value === "") return;

    if (!Number.isInteger(value * 10)) {
      ctx.addIssue({
        code: "custom",
        message: "Handicap index must use one decimal place or less",
      });
    }
  });

const roundScoreFormEntrySchema = z.object({
  hole: z.number().int().min(1).max(18),
  strokes: optionalInt("Strokes", 1),
  putts: optionalInt("Putts", 0),
});

const roundGreenieFormEntrySchema = z
  .object({
    hole: z.number().int().min(1).max(18),
    feet: optionalInt("Feet", 0),
    inches: optionalInt("Inches", 0, 11),
    action: z.enum(["none", "upsert", "delete"]),
  })
  .superRefine((greenie, ctx) => {
    if (greenie.action !== "upsert") return;

    if (greenie.feet === "") {
      ctx.addIssue({
        code: "custom",
        path: ["feet"],
        message: "Feet is required",
      });
    }

    if (greenie.inches === "") {
      ctx.addIssue({
        code: "custom",
        path: ["inches"],
        message: "Inches is required",
      });
    }
  });

export const RoundScoresUpdateSchema = z.object({
  roundId: z.number().int().positive(),
  teeId: z.number().int().positive("Tees are required"),
  handicapIndexOverride: optionalHandicapIndex,
  scores: z
    .array(roundScoreFormEntrySchema)
    .length(18, "Rounds must have 18 holes")
    .refine(
      (scores) => scores.every((score, index) => score.hole === index + 1),
      "Hole numbers must be 1 through 18",
    ),
  greenies: z.array(roundGreenieFormEntrySchema),
});

export type RoundScoresUpdateValues = z.input<typeof RoundScoresUpdateSchema>;
