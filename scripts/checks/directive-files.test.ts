import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  exactPaths,
  filesWithDirective,
  hasDirective,
} from "./directive-files.cjs";

describe("hasDirective", () => {
  it.each([
    ['"use client";\nexport {};', "double quotes"],
    ["'use client'\nexport {};", "single quotes, no semicolon"],
    ['// note\n/* block\n comment */\n"use client";\n', "after comments"],
    ['"use strict";\n"use client";\n', "after another directive"],
    [
      '"use strict" ;\n"use client";\n',
      "after a directive spaced from its semicolon",
    ],
    ['  \n\t"use client"', "after whitespace"],
  ])("finds the directive %#: %s", (source) => {
    expect(hasDirective(source, "use client")).toBe(true);
  });

  it.each([
    ['import x from "y";\n"use client";\n', "after a statement"],
    ['"use server";\n', "a different directive"],
    ['const a = "use client";\n', "a string that is not a statement"],
    ['export function f() {\n  "use client";\n}\n', "inside a function"],
    ["\"use client';\n", "mismatched quotes"],
    ["", "an empty file"],
  ])("ignores %#: %s", (source) => {
    expect(hasDirective(source, "use client")).toBe(false);
  });
});

describe("filesWithDirective", () => {
  it("lists source files under the folder whose prologue holds the directive", async () => {
    const dir = await mkdtemp(join(tmpdir(), "directive-files-"));
    try {
      await mkdir(join(dir, "src/a/b"), { recursive: true });
      await writeFile(join(dir, "src/a/b/client.tsx"), '"use client";\n');
      await writeFile(join(dir, "src/a/client.js"), "'use client'\n");
      await writeFile(join(dir, "src/server.ts"), '"use server";\n');
      await writeFile(join(dir, "src/notes.md"), '"use client";\n');
      await writeFile(join(dir, "src/client.tsx.snap"), '"use client";\n');
      const found = filesWithDirective(join(dir, "src"), "use client");
      expect(found.map((path) => relative(dir, path)).sort()).toEqual([
        "src/a/b/client.tsx",
        "src/a/client.js",
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("exactPaths", () => {
  it("matches only the listed paths, taking dots and brackets literally", () => {
    const pattern = new RegExp(
      exactPaths(["src/app/[id]/page.tsx", "src/a.ts"]),
    );
    expect(pattern.test("src/app/[id]/page.tsx")).toBe(true);
    expect(pattern.test("src/a.ts")).toBe(true);
    expect(pattern.test("src/axts")).toBe(false);
    expect(pattern.test("src/a.ts.bak")).toBe(false);
    expect(pattern.test("x/src/a.ts")).toBe(false);
  });

  it("matches nothing when there are no paths", () => {
    expect(new RegExp(exactPaths([])).test("src/a.ts")).toBe(false);
  });
});
