import type { revalidatePath as RevalidatePath } from "next/cache";
import { vi } from "vitest";

type RoundRef = {
  id: number;
  playerId: string;
  tournamentId?: number | null;
  matchId?: number | null;
};

// Each call a mocked revalidatePath received, as a sorted "path type" string.
export function invalidatedPaths(revalidatePath: typeof RevalidatePath) {
  return vi
    .mocked(revalidatePath)
    .mock.calls.map((call) => call.join(" "))
    .sort();
}

// The "Round changed" page set for `rounds`, in invalidatedPaths' form.
export function roundChangedPaths(...rounds: RoundRef[]) {
  const paths = new Set(["/", "/records", "/clubs/[handle] page"]);
  for (const round of rounds) {
    paths.add(`/players/${round.playerId}`);
    paths.add(`/rounds/${round.id}`);
    if (round.tournamentId != null) {
      paths.add(`/tournaments/${round.tournamentId}`);
    }
    if (round.matchId != null) paths.add(`/matches/${round.matchId}`);
  }
  return [...paths].sort();
}
