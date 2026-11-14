import { z } from "zod";

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
    positions: z.array(intNonNeg).min(1, "At least one position is required"),
  }),
  putts: z.object({
    positions: z.array(intNonNeg).min(1, "At least one position is required"),
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
