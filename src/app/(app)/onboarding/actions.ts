"use server";

import { redirect } from "next/navigation";
import { unstable_update } from "@/auth";
import {
  completeOnboarding,
  getSignedInPlayer,
} from "@/modules/players/server";
import { OnboardingSchema, type OnboardingValues } from "./schema";

export async function submitOnboarding(
  values: OnboardingValues,
): Promise<{ error: string } | void> {
  const player = await getSignedInPlayer();
  if (!player) redirect("/");

  const parsed = OnboardingSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { firstName, lastName } = parsed.data;
  const result = await completeOnboarding(player.id, { firstName, lastName });
  if (!result.ok) return { error: result.error };

  await unstable_update({
    // oxlint-disable-next-line local/player-domain-term -- Auth.js session shape
    user: {
      username: result.username,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
    },
  });

  redirect("/");
}
