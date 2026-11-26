import { describe, expect, it } from "vitest";

import { sessionCookieHeader } from "./session-cookie";

describe("sessionCookieHeader", () => {
  it("keeps only the session cookie from the callback's Set-Cookie headers", () => {
    expect(
      sessionCookieHeader([
        "authjs.callback-url=http%3A%2F%2Flocalhost%3A3000; Path=/; HttpOnly; SameSite=Lax",
        "authjs.session-token=eyJhbGc.abc; Path=/; Expires=Sat, 26 Dec 2026 00:00:00 GMT; HttpOnly; SameSite=Lax",
      ]),
    ).toBe("Cookie: authjs.session-token=eyJhbGc.abc");
  });

  it("keeps the __Secure- session cookie an https server sets", () => {
    expect(
      sessionCookieHeader([
        "__Secure-authjs.session-token=eyJhbGc.abc; Path=/; HttpOnly; Secure; SameSite=Lax",
      ]),
    ).toBe("Cookie: __Secure-authjs.session-token=eyJhbGc.abc");
  });

  it("keeps every chunk of a session too big for one cookie", () => {
    expect(
      sessionCookieHeader([
        "authjs.session-token.0=eyJhbGc; Path=/; HttpOnly",
        "authjs.session-token.1=.abc; Path=/; HttpOnly",
      ]),
    ).toBe(
      "Cookie: authjs.session-token.0=eyJhbGc; authjs.session-token.1=.abc",
    );
  });

  it("throws when the callback only cleared the session", () => {
    expect(() =>
      sessionCookieHeader([
        "authjs.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
      ]),
    ).toThrow(/no session cookie/i);
  });

  it("throws when the callback set no session, as on a rejected link", () => {
    expect(() =>
      sessionCookieHeader([
        "authjs.callback-url=http%3A%2F%2Flocalhost%3A3000; Path=/",
      ]),
    ).toThrow(/no session cookie/i);
  });
});
