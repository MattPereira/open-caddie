import { displayName } from "@/modules/players";
import { getPlayerById } from "@/modules/players/server";
import { githubToken } from "./github";

export type Reporter = { id: string; name: string };

function isProblemReportingConfigured(): boolean {
  return githubToken() !== undefined && process.env.VERCEL_ENV === "production";
}

/** Reads the stored Player row, never the session or form input. */
export async function getProblemReporter(
  playerId: string | null,
): Promise<Reporter | null> {
  if (!isProblemReportingConfigured() || !playerId) return null;
  const player = await getPlayerById(playerId);
  // Reports land labelled `agent:explore` and reach the explore agent without
  // the repo owner reviewing them, so Platform Admins are trusted like
  // collaborators here. Do not widen sending beyond them without revisiting
  // that trust (see #218).
  if (!player?.isAdmin) return null;
  return { id: player.id, name: displayName(player) };
}

export async function isProblemReporter(
  playerId: string | null,
): Promise<boolean> {
  return (await getProblemReporter(playerId)) !== null;
}
