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
