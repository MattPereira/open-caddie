import { describe, expect, it } from "vitest";
import type { TestProject } from "vitest/node";

import setup from "./db-global-setup";

function run(env: Record<string, string>) {
  return setup({ config: { env } } as unknown as TestProject);
}

// Matching "Refusing" matters: a connect attempt would also fail and name the
// host, but as a DNS error after reaching for the server.
describe("db project global setup", () => {
  it("refuses a non-local TEST_DATABASE_URL host, naming it", async () => {
    await expect(
      run({ TEST_DATABASE_URL: "postgres://u:p@db.example.com:5432/app" }),
    ).rejects.toThrow(/Refusing .*"db\.example\.com"/);
  });

  it("refuses a non-socket value in the local-socket env", async () => {
    await expect(
      run({
        TEST_DATABASE_URL: "postgres://u:p@localhost:5432/app",
        DATABASE_LOCAL_SOCKET: "db.example.com",
      }),
    ).rejects.toThrow(/Refusing .*"db\.example\.com"/);
  });
});
