import { z } from "zod";

export const TournamentFormSchema = z.object({
  clubHandle: z.string().trim().min(1, "Club is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  season: z.union([
    z
      .number({ message: "Season must be a number" })
      .int("Season must be a whole number")
      .nonnegative("Season cannot be negative"),
    z.literal(""),
  ]),
  startsAt: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Start time is required"),
  courseHandle: z.string().trim().min(1, "Course is required"),
  teeId: z
    .union([z.number().int().positive(), z.literal("")])
    .refine((v) => typeof v === "number", { message: "Tee is required" }),
});

export const TournamentCreateSchema = TournamentFormSchema;
export const TournamentUpdateSchema = TournamentFormSchema.extend({
  id: z.number().int().positive(),
});

export type TournamentFormValues = z.input<typeof TournamentFormSchema>;
export type TournamentCreateValues = z.infer<typeof TournamentCreateSchema>;
export type TournamentUpdateValues = z.infer<typeof TournamentUpdateSchema>;
