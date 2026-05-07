import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

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
        <div className="flex shrink-0 items-center gap-1.5">
          <GreenieStat label="Hole" value={greenie.hole} />
          <GreenieStat label="Distance" value={formatGreenieDistance(greenie)} />
        </div>
      </CardContent>
    </Card>
  );
}

function GreenieStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex min-w-16 flex-col gap-0.5 rounded-md bg-muted px-3 py-1.5">
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
      </div>
      <span className="text-end text-sm font-semibold tabular-nums text-card-foreground">
        {value}
      </span>
    </div>
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
