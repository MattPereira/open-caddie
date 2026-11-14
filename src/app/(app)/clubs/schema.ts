import { z } from "zod";
import {
  PointRulesSchema,
  type PointRules,
} from "@/modules/clubs/point-rules";

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

export type ClubFormValues = z.infer<typeof ClubFormSchema>;
export type { PointRules };
