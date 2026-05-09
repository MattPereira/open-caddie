import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/stat-tile";

export type GreenieCardGreenie = {
  hole: number;
  feet: number;
  inches: number;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
  courseName: string;
};

export function GreenieCard({ greenie }: { greenie: GreenieCardGreenie }) {
  const playerName = formatGreeniePlayerName(greenie);

  return (
    <Card size="sm" className="gap-0 py-0!">
      <CardContent className="flex items-center gap-3 p-2!">
        <Avatar className="size-15 rounded-lg">
          {greenie.image ? (
            <AvatarImage src={greenie.image} alt={playerName} />
          ) : null}
          <AvatarFallback className="rounded-lg">
            {getInitials(greenie)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <CardTitle className="truncate">{playerName}</CardTitle>
          <span className="truncate text-xs text-muted-foreground">
            {greenie.courseName}
          </span>
        </div>
        <div className="flex shrink-0 items-stretch gap-1.5 self-stretch sm:items-center sm:self-auto">
          <StatTile label="Hole" value={greenie.hole} size="responsive" />
          <StatTile
            label="Dist"
            value={formatGreenieDistance(greenie)}
            size="responsive"
          />
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
