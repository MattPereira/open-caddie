import { z } from "zod";

export const TournamentFormSchema = z.object({
  clubHandle: z.string().trim().min(1, "Club is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  seasonId: z.union([z.number().int().positive(), z.literal("")]),
  startNextSeason: z.boolean(),
  courseHandle: z.string().trim().min(1, "Course is required"),
  teeId: z
    .union([z.number().int().positive(), z.literal("")])
    .refine((v) => typeof v === "number", { message: "Tee is required" }),
});

export const TournamentCreateSchema = TournamentFormSchema;
export const TournamentUpdateSchema = TournamentFormSchema.extend({
  id: z.number().int().positive(),
}).refine(({ seasonId }) => seasonId !== "", { message: "Season is required", path: ["seasonId"] });

export type TournamentFormValues = z.input<typeof TournamentFormSchema>;
export type TournamentCreateValues = z.infer<typeof TournamentCreateSchema>;
export type TournamentUpdateValues = z.infer<typeof TournamentUpdateSchema>;
