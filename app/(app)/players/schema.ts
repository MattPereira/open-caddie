import { z } from "zod";

export const UserFormSchema = z.object({
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

export const UserCreateSchema = UserFormSchema;
export const UserUpdateSchema = UserFormSchema.extend({
  id: z.string().min(1),
});

export type UserFormValues = z.infer<typeof UserFormSchema>;
export type UserCreateValues = z.infer<typeof UserCreateSchema>;
export type UserUpdateValues = z.infer<typeof UserUpdateSchema>;
