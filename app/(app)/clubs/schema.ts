import { z } from "zod";
import {
  PointRulesSchema,
  type PointRules,
} from "@/lib/point-rules-schema";

export const ClubFormSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(1, "Handle is required")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  name: z.string().trim().min(1, "Name is required").max(100),
  logo: z.union([z.url("Must be a valid URL").max(2048), z.literal("")]),
  pointRules: PointRulesSchema,
});

export const ClubCreateSchema = ClubFormSchema;
export const ClubUpdateSchema = ClubFormSchema;

export type ClubFormValues = z.infer<typeof ClubFormSchema>;
export type ClubCreateValues = z.infer<typeof ClubCreateSchema>;
export type ClubUpdateValues = z.infer<typeof ClubUpdateSchema>;
export type { PointRules };
