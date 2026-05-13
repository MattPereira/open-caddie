import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/stat-tile";

export type GreenieCardGreenie = {
  hole: number;
  feet: number;
  inches: number;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
};

type GreenieCardProps = {
  greenie: GreenieCardGreenie;
  details?: string;
};

export function GreenieCard({ greenie, details }: GreenieCardProps) {
  const playerName = formatGreeniePlayerName(greenie);

  return (
    <Card size="sm" className="gap-0 py-1.5!">
      <CardContent className="flex gap-2 px-1.5!">
        <Avatar className="size-16 rounded-lg">
          {greenie.image ? (
            <AvatarImage src={greenie.image} alt={playerName} />
          ) : null}
          <AvatarFallback className="rounded-lg">
            {getInitials(greenie)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 min-w-0 self-stretch items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="truncate text-base">{playerName}</div>
            {details ? (
              <span className="truncate text-xs text-muted-foreground">
                {details}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col justify-end h-full">
            <div className="flex flex-row items-end gap-2 h-full">
              <StatTile
                className="w-16"
                label="Hole"
                value={greenie.hole.toString()}
              />
              <StatTile
                className="w-16"
                label="Dist"
                value={formatGreenieDistance(greenie)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function formatGreeniePlayerName(greenie: GreenieCardGreenie) {
  const fullName = [greenie.firstName, greenie.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || greenie.username || "Unknown player";
}

function getInitials(greenie: GreenieCardGreenie) {
  const first = greenie.firstName?.trim()?.[0];
  const last = greenie.lastName?.trim()?.[0];
  const initials = `${first ?? ""}${last ?? ""}`.toUpperCase();
  if (initials) return initials;
  const fallback = (greenie.username ?? "?").trim();
  return fallback.slice(0, 2).toUpperCase();
}

export function formatGreenieDistance(
  greenie: Pick<GreenieCardGreenie, "feet" | "inches">,
) {
  if (greenie.inches === 0) {
    return `${greenie.feet}'`;
  }

  return `${greenie.feet}' ${greenie.inches}"`;
}
