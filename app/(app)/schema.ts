import { z } from "zod";

export const RoundConfigSchema = z.object({
  courseHandle: z.string().trim().min(1, "Course is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  tournamentId: z.number().int().positive().nullable(),
});

export type RoundConfigValues = z.infer<typeof RoundConfigSchema>;
