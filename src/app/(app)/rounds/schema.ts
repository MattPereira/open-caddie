import { z } from "zod";
import { HOLE_COUNT } from "@/modules/courses/holes";

export const RoundConfigSchema = z.object({
  courseHandle: z.string().trim().min(1, "Course is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  tournamentId: z.number().int().positive().nullable(),
  teeId: z.number().int().positive().nullable(),
});

export type RoundConfigValues = z.infer<typeof RoundConfigSchema>;

// A field left out keeps its stored value; null clears it.
const holeScoreChangeSchema = z.object({
  hole: z.number().int().min(1).max(HOLE_COUNT),
  strokes: z.number().int().min(1).nullable().optional(),
  putts: z.number().int().min(0).nullable().optional(),
});

export const RoundScoreSchema = holeScoreChangeSchema.extend({
  roundId: z.number().int().positive(),
});

export type RoundScoreValues = z.infer<typeof RoundScoreSchema>;

export const RoundScorecardChangesSchema = z.object({
  roundId: z.number().int().positive(),
  scores: z.array(holeScoreChangeSchema).max(HOLE_COUNT),
  greenies: z
    .array(
      z.object({
        hole: z.number().int().min(1).max(HOLE_COUNT),
        distance: z
          .object({
            feet: z.number().int().min(0),
            inches: z.number().int().min(0).max(11),
          })
          .nullable(),
      }),
    )
    .max(HOLE_COUNT),
});

export type RoundScorecardChangesValues = z.infer<
  typeof RoundScorecardChangesSchema
>;

export const RoundGreenieSchema = z.object({
  roundId: z.number().int().positive(),
  hole: z.number().int().min(1).max(HOLE_COUNT),
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

const optionalPlayerIndex = z
  .union([
    z
      .number({ message: "Player index must be a number" })
      .min(-10, "Player index must be at least -10.0")
      .max(54, "Player index must be 54.0 or less"),
    z.literal(""),
  ])
  .superRefine((value, ctx) => {
    if (value === "") return;

    if (!Number.isInteger(value * 10)) {
      ctx.addIssue({
        code: "custom",
        message: "Player index must use one decimal place or less",
      });
    }
  });

const roundScoreFormEntrySchema = z.object({
  hole: z.number().int().min(1).max(HOLE_COUNT),
  strokes: optionalInt("Strokes", 1),
  putts: optionalInt("Putts", 0),
});

const roundGreenieFormEntrySchema = z
  .object({
    hole: z.number().int().min(1).max(HOLE_COUNT),
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

// A field left out keeps its stored value; "" clears the override.
export const RoundSettingsSchema = z.object({
  roundId: z.number().int().positive(),
  teeId: z.number().int().positive("Tees are required").optional(),
  playerIndexOverride: optionalPlayerIndex.optional(),
});

export type RoundSettingsValues = z.input<typeof RoundSettingsSchema>;

// Form state for the round-page sheet. Only what changed is sent, split into
// scorecard changes and a settings change.
export const RoundSheetFormSchema = z.object({
  roundId: z.number().int().positive(),
  teeId: z.number().int().positive("Tees are required"),
  playerIndexOverride: optionalPlayerIndex,
  scores: z
    .array(roundScoreFormEntrySchema)
    .length(HOLE_COUNT, "Rounds must have 18 holes")
    .refine(
      (scores) => scores.every((score, index) => score.hole === index + 1),
      "Hole numbers must be 1 through 18",
    ),
  greenies: z.array(roundGreenieFormEntrySchema),
});

export type RoundSheetFormValues = z.input<typeof RoundSheetFormSchema>;
