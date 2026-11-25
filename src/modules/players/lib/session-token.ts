type ProfileClaims = {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
};

type SignedInPlayer = ProfileClaims & {
  id?: string;
  isPlatformAdmin?: boolean;
};

type SessionToken = Record<string, unknown>;

/**
 * The Auth.js `jwt` callback's claims. A session update comes from the client,
 * so it may change profile fields only: the Platform Admin claim is written at
 * sign-in, from the stored row.
 */
export function sessionTokenClaims<Token extends SessionToken>({
  token,
  player,
  update,
}: {
  token: Token;
  player?: SignedInPlayer;
  update?: ProfileClaims;
}): Token {
  const next: SessionToken = { ...token };
  if (player) {
    if (!player.id)
      throw new Error("Auth.js adapter returned a user without an id");
    next.id = player.id;
    next.username = player.username ?? null;
    next.firstName = player.firstName ?? null;
    next.lastName = player.lastName ?? null;
    next.isPlatformAdmin = player.isPlatformAdmin ?? false;
  }
  if (update) {
    if (update.username !== undefined) next.username = update.username;
    if (update.firstName !== undefined) next.firstName = update.firstName;
    if (update.lastName !== undefined) next.lastName = update.lastName;
    if (update.name !== undefined) next.name = update.name;
  }
  return next as Token;
}
