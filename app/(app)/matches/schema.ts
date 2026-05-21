import { z } from "zod";

export const MatchFormSchema = z.object({
  name: z.string().trim(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  startsAt: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Start time is required"),
  courseHandle: z.string().trim().min(1, "Course is required"),
});

export const MatchCreateSchema = MatchFormSchema;
export const MatchUpdateSchema = MatchFormSchema.extend({
  id: z.number().int().positive(),
});

export type MatchFormValues = z.input<typeof MatchFormSchema>;
export type MatchCreateValues = z.infer<typeof MatchCreateSchema>;
export type MatchUpdateValues = z.infer<typeof MatchUpdateSchema>;
