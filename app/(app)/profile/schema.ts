import { z } from "zod";

export const ProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  email: z.email("Must be a valid email").max(254),
  image: z
    .union([z.url("Must be a valid URL").max(2048), z.literal("")])
    .optional(),
});

export type ProfileValues = z.infer<typeof ProfileSchema>;
