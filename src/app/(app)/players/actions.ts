"use server";

import { headers } from "next/headers";
import { signIn } from "@/auth";
import { createSignInLink } from "@/lib/auth/sign-in-link";
import * as players from "@/modules/players";
import {
  PlayerCreateSchema,
  PlayerUpdateSchema,
  type PlayerCreateValues,
  type PlayerUpdateValues,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

const SIGNED_OUT = { ok: false, error: "You must be signed in." } as const;

export async function createPlayer(
  values: PlayerCreateValues,
): Promise<ActionResult> {
  const actor = await players.getSignedInPlayer();
  if (!actor) return SIGNED_OUT;

  const parsed = PlayerCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const result = await players.createPlayer(actor.id, parsed.data);
  if (!result.ok) return result;

  await signIn("resend", {
    email: parsed.data.email.toLowerCase(),
    redirect: false,
    redirectTo: "/",
  });
  return result;
}

export async function updatePlayer(
  values: PlayerUpdateValues,
): Promise<ActionResult> {
  const actor = await players.getSignedInPlayer();
  if (!actor) return SIGNED_OUT;

  const parsed = PlayerUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return players.updatePlayer(actor.id, parsed.data);
}

export async function deletePlayer(id: string): Promise<ActionResult> {
  const actor = await players.getSignedInPlayer();
  if (!actor) return SIGNED_OUT;

  return players.deletePlayer(actor.id, id);
}

export async function createPlayerSignInLink(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const actor = await players.getSignedInPlayer();
  if (!actor) return SIGNED_OUT;

  const admin = await players.requirePlatformAdmin(
    actor.id,
    "Only Platform Admins can create sign-in links.",
  );
  if (!admin.ok) return admin;

  const headerList = await headers();
  const host = headerList.get("host");
  if (!host) {
    return { ok: false, error: "Could not determine the app URL." };
  }
  const protocol = host.startsWith("localhost") ? "http" : "https";

  return createSignInLink({ playerId: id, origin: `${protocol}://${host}` });
}
