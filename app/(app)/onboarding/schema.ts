import { z } from "zod";

export const OnboardingSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
});

export type OnboardingValues = z.infer<typeof OnboardingSchema>;
