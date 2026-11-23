import { displayName } from "@/modules/players";
import { getPlayerById } from "@/modules/players/server";
import { githubToken } from "./github";

export type Reporter = { id: string; name: string };

function isBugReportingConfigured(): boolean {
  return githubToken() !== undefined && process.env.VERCEL_ENV === "production";
}

/** Reads the stored Player row, never the session or form input. */
export async function getBugReporter(
  playerId: string | null,
): Promise<Reporter | null> {
  if (!isBugReportingConfigured() || !playerId) return null;
  const player = await getPlayerById(playerId);
  // Reports are labelled `live-bug-report`, then `agent:explore` once prod is
  // snapshotted, and reach the explore agent without
  // the repo owner reviewing them, so Platform Admins are trusted like
  // collaborators here. Do not widen sending beyond them without revisiting
  // that trust (see #218).
  if (!player?.isAdmin) return null;
  return { id: player.id, name: displayName(player) };
}

export async function isBugReporter(playerId: string | null): Promise<boolean> {
  return (await getBugReporter(playerId)) !== null;
}
