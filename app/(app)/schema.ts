import { z } from "zod";

export const RoundConfigSchema = z.object({
  courseHandle: z.string().trim().min(1, "Course is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  tournamentId: z.number().int().positive().nullable(),
});

export type RoundConfigValues = z.infer<typeof RoundConfigSchema>;

export const RoundScoreSchema = z.object({
  roundId: z.number().int().positive(),
  hole: z.number().int().min(1).max(18),
  strokes: z.number().int().min(1).nullable(),
  putts: z.number().int().min(0).nullable(),
});

export type RoundScoreValues = z.infer<typeof RoundScoreSchema>;
