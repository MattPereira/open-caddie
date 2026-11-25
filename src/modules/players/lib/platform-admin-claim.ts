/**
 * The Platform Admin claim of a session token. Switch of #95: a token minted
 * before its expand carries only the old `isAdmin` claim, so fall back to it.
 * The contract step removes the fallback.
 */
export function platformAdminClaim(token: Record<string, unknown>): boolean {
  if (typeof token.isPlatformAdmin === "boolean") return token.isPlatformAdmin;
  return token.isAdmin === true;
}
