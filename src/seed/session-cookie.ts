const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

export function sessionCookieHeader(setCookies: string[]): string {
  const pairs = setCookies
    .map((setCookie) => setCookie.split(";")[0])
    .filter((pair) => {
      const [name, value] = pair.split("=");
      return SESSION_COOKIE.test(name) && value !== "";
    });
  if (pairs.length === 0)
    throw new Error("The response set no session cookie.");
  return `Cookie: ${pairs.join("; ")}`;
}
