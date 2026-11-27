import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const { scripts } = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

// tsx and node take any path without complaint until the command runs, so a
// moved script would otherwise break only when someone next runs it.
const SCRIPT_FILE =
  /(?:^|\s)(?:\.\/)?((?:src|scripts|evals)\/[\w./-]+\.(?:ts|mjs))/g;

const referencedFiles = Object.entries(scripts).flatMap(([name, command]) =>
  [...command.matchAll(SCRIPT_FILE)].map((match) => ({
    name,
    file: match[1],
  })),
);

describe("package.json scripts", () => {
  it("reference at least the seed and dev-agent scripts", () => {
    const files = referencedFiles.map(({ file }) => file);
    expect(files).toContain("scripts/seed/index.ts");
    expect(files).toContain("scripts/seed/register.mjs");
    expect(files).toContain("scripts/dev/dev-agent.ts");
  });

  it.each(referencedFiles)("$name runs $file, which exists", ({ file }) => {
    expect(existsSync(file)).toBe(true);
  });
});
