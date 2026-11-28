import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it.each([[], ["11111111111111111111111111111111", "extra"]])(
  "requires exactly one selected run ID: %j",
  async (...args) => {
    await expect(
      promisify(execFile)(process.execPath, [
        "node_modules/tsx/dist/cli.mjs",
        "scripts/test/cleanup.ts",
        ...args,
      ]),
    ).rejects.toThrow("Usage: pnpm test:db:cleanup <run-id>");
  },
);

it("refuses a broad cleanup selector", async () => {
  await expect(
    promisify(execFile)(process.execPath, [
      "node_modules/tsx/dist/cli.mjs",
      "scripts/test/cleanup.ts",
      "all",
    ]),
  ).rejects.toThrow(
    "TEST_DATABASE_RUN_ID must be 32 lowercase hexadecimal characters",
  );
});

it("refuses a non-local maintenance database", async () => {
  await expect(
    promisify(execFile)(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "scripts/test/cleanup.ts",
        "11111111111111111111111111111111",
      ],
      {
        env: {
          ...process.env,
          TEST_DATABASE_URL: "postgresql://db.example.com/test",
          DATABASE_LOCAL_SOCKET: "",
        },
      },
    ),
  ).rejects.toThrow(/Refusing .*"db\.example\.com"/);
});
