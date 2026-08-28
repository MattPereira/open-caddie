import { PlayerCard } from "@/components/domain/player-card";
import { displayName } from "@/lib/players/player-name";
import { AddPlayersSheet, type AddablePlayer } from "./add-players-sheet";

type TournamentPlayer = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
};

// The roster is the Tournament's Rounds — adding a player is what creates one.
// Pairing membership deliberately stays out of this list; the Pairings tab is
// the one place that grouping is read and written.
export function TournamentPlayers({
  tournamentId,
  players,
  addablePlayers,
}: {
  tournamentId: number;
  players: TournamentPlayer[];
  addablePlayers: AddablePlayer[];
}) {
  // Rounds carry no email, which PlayerCard reads, so add it once here.
  const roster = players
    .map((player) => ({ ...player, email: null }))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {roster.length} {roster.length === 1 ? "player" : "players"}
        </p>
        <div className="ml-auto">
          <AddPlayersSheet
            tournamentId={tournamentId}
            players={addablePlayers}
          />
        </div>
      </div>

      {roster.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No players have been added to this tournament.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {roster.map((player) => (
            <li key={player.id}>
              <PlayerCard player={player} size="sm" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
