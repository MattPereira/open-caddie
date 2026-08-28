import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { displayName, getInitials } from "@/lib/players/player-name";
import type {
  TournamentPairing,
  TournamentPairingMember,
} from "@/lib/tournaments/queries";

// Read-only for everyone: the Tournament page explains the grouping that
// unlocked peer score entry, while every change to it happens on the admin-only
// Pairings page. Empty Pairings and unassigned players are omitted — a player
// reads this to find where someone in the field is playing, and neither puts
// anyone anywhere.
export function PairingsList({
  pairings,
  currentUserId,
}: {
  pairings: TournamentPairing[];
  currentUserId: string | null;
}) {
  const populatedPairings = pairings.filter(
    (pairing) => pairing.members.length > 0,
  );
  if (populatedPairings.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-normal">Pairings</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {populatedPairings.map((pairing) => {
          const isCurrentUserPairing = pairing.members.some(
            (member) => member.userId === currentUserId,
          );

          return (
            <li
              key={pairing.id}
              className="flex flex-col gap-3 rounded-xl border px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-base font-medium">
                  {pairing.name}
                </span>
                {isCurrentUserPairing ? (
                  <Badge variant="secondary">Your pairing</Badge>
                ) : null}
              </div>
              <ul className="flex flex-col gap-2">
                {pairing.members.map((member) => (
                  <MemberRow key={member.roundId} member={member} />
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// A plain row rather than a PlayerCard: a bordered card nested inside the
// bordered Pairing would read as two frames around one name.
function MemberRow({ member }: { member: TournamentPairingMember }) {
  const name = displayName(member);

  return (
    <li className="flex items-center gap-2">
      <Avatar className="size-6">
        {member.image ? <AvatarImage src={member.image} alt={name} /> : null}
        <AvatarFallback className="text-[0.625rem]">
          {getInitials(member)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-sm">{name}</span>
    </li>
  );
}
