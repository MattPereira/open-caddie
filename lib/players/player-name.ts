export type PlayerCardPlayer = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
  isAdmin?: boolean;
  roundsCount?: number;
  greeniesCount?: number;
};

export function displayName(player: PlayerCardPlayer) {
  const full = [player.firstName, player.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || player.username || player.email || "Unnamed user";
}

export function getInitials(player: PlayerCardPlayer) {
  const first = player.firstName?.trim()?.[0];
  const last = player.lastName?.trim()?.[0];
  const initials = `${first ?? ""}${last ?? ""}`.toUpperCase();
  if (initials) return initials;
  const fallback = (player.username ?? player.email ?? "?").trim();
  return fallback.slice(0, 2).toUpperCase();
}
