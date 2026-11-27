import { describe, expect, it } from "vitest";

import { prodCopyUrl } from "./prod-copy-url";

describe("prodCopyUrl", () => {
  it("swaps the database of a socket URL and keeps the host param", () => {
    expect(
      prodCopyUrl("postgresql:///open_caddie?host=/var/run/postgresql"),
    ).toBe("postgresql:///open_caddie_prod?host=/var/run/postgresql");
  });

  it("swaps the database of a TCP URL and keeps credentials and port", () => {
    expect(
      prodCopyUrl("postgres://postgres:postgres@localhost:5432/open_caddie"),
    ).toBe("postgres://postgres:postgres@localhost:5432/open_caddie_prod");
  });

  it("adds the database to a URL that has none", () => {
    expect(prodCopyUrl("postgres://localhost")).toBe(
      "postgres://localhost/open_caddie_prod",
    );
  });
});
