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

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required");

export const SeasonFormSchema = z
  .object({
    clubHandle: z.string().trim().min(1, "Club is required"),
    number: z
      .number({ message: "Season number is required" })
      .int("Season number must be a whole number")
      .positive("Season number must be positive"),
    startDate: dateString,
    endDate: dateString,
  })
  .refine((data) => data.endDate >= data.startDate, {
    path: ["endDate"],
    message: "End date must be on or after the start date",
  });

export const SeasonCreateSchema = SeasonFormSchema;
export const SeasonUpdateSchema = z
  .object({
    id: z.number().int().positive(),
    clubHandle: z.string().trim().min(1, "Club is required"),
    number: z
      .number({ message: "Season number is required" })
      .int("Season number must be a whole number")
      .positive("Season number must be positive"),
    startDate: dateString,
    endDate: dateString,
  })
  .refine((data) => data.endDate >= data.startDate, {
    path: ["endDate"],
    message: "End date must be on or after the start date",
  });

export type SeasonFormValues = z.infer<typeof SeasonFormSchema>;
export type SeasonCreateValues = z.infer<typeof SeasonCreateSchema>;
export type SeasonUpdateValues = z.infer<typeof SeasonUpdateSchema>;
