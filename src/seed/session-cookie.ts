const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

/** The `Cookie:` header that replays the session a sign-in callback set. */
export function sessionCookieHeader(setCookies: string[]): string {
  const pairs = setCookies
    .map((setCookie) => setCookie.split(";")[0])
    .filter((pair) => SESSION_COOKIE.test(pair.split("=")[0]));
  if (pairs.length === 0) {
    throw new Error(
      "The sign-in link set no session cookie. Is the server at AUTH_URL running, with the same AUTH_SECRET?",
    );
  }
  return `Cookie: ${pairs.join("; ")}`;
}
