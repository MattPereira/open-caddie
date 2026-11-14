// Client-safe: no server imports.

export type NamedPlayer = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
};

export function displayName(player: NamedPlayer) {
  const full = [player.firstName, player.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || player.username || player.email || "Unnamed player";
}

export function getInitials(player: NamedPlayer) {
  const first = player.firstName?.trim()?.[0];
  const last = player.lastName?.trim()?.[0];
  const initials = `${first ?? ""}${last ?? ""}`.toUpperCase();
  if (initials) return initials;
  const fallback = (player.username ?? player.email ?? "?").trim();
  return fallback.slice(0, 2).toUpperCase();
}

export type SortablePlayer = {
  playerId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
};

export function comparePlayers(a: SortablePlayer, b: SortablePlayer) {
  return (
    (a.lastName ?? "").localeCompare(b.lastName ?? "") ||
    (a.firstName ?? "").localeCompare(b.firstName ?? "") ||
    (a.username ?? "").localeCompare(b.username ?? "") ||
    a.playerId.localeCompare(b.playerId)
  );
}
