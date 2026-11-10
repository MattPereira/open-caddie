import { z } from "zod";

export const PlayerFormSchema = z.object({
  email: z.email("Must be a valid email").max(254),
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  username: z
    .string()
    .trim()
    .max(50)
    .regex(/^[A-Za-z0-9-]*$/, "Letters, numbers, and hyphens only"),
  image: z.union([z.url("Must be a valid URL").max(2048), z.literal("")]),
  isAdmin: z.boolean(),
});

export const PlayerCreateSchema = PlayerFormSchema;
export const PlayerUpdateSchema = PlayerFormSchema.extend({
  id: z.string().min(1),
});

export type PlayerFormValues = z.infer<typeof PlayerFormSchema>;
export type PlayerCreateValues = z.infer<typeof PlayerCreateSchema>;
export type PlayerUpdateValues = z.infer<typeof PlayerUpdateSchema>;
