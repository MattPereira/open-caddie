import { z } from "zod";

// The form starts a select as "", so it's accepted in, but the output is the
// id the mutations take.
function requiredId(message: string) {
  return z
    .union([z.number().int().positive(), z.literal("")])
    .transform((value, ctx) => {
      if (value === "") {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return value;
    });
}

export const TournamentFormSchema = z.object({
  clubHandle: z.string().trim().min(1, "Club is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  seasonId: z.union([z.number().int().positive(), z.literal("")]),
  startNextSeason: z.boolean(),
  courseHandle: z.string().trim().min(1, "Course is required"),
  teeId: requiredId("Tee is required"),
});

export const TournamentCreateSchema = TournamentFormSchema;
export const TournamentUpdateSchema = TournamentFormSchema.extend({
  id: z.number().int().positive(),
  seasonId: requiredId("Season is required"),
});

export type TournamentFormValues = z.input<typeof TournamentFormSchema>;
export type TournamentCreateValues = z.input<typeof TournamentCreateSchema>;
export type TournamentUpdateValues = z.input<typeof TournamentUpdateSchema>;
