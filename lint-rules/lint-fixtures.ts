import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = process.cwd();

export type Diagnostic = { rule: string; message: string };

// Lints fixtures with the real .oxlintrc.json, so path-based overrides are
// tested too. Fixture paths mirror repo paths inside a temp copy of the config.
// One oxlint run for every fixture: process start dominates the cost.
export async function lintFixtures(
  files: Record<string, string>,
): Promise<Map<string, Diagnostic[]>> {
  const dir = await mkdtemp(join(tmpdir(), "lint-fixtures-"));
  try {
    await cp(join(ROOT, ".oxlintrc.json"), join(dir, ".oxlintrc.json"));
    await cp(join(ROOT, "lint-rules"), join(dir, "lint-rules"), {
      recursive: true,
    });
    for (const [path, code] of Object.entries(files)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), code);
    }
    const { stdout } = await run(
      join(ROOT, "node_modules/.bin/oxlint"),
      ["--format", "json", ...Object.keys(files)],
      { cwd: dir },
    ).catch((error: { stdout?: string }) => {
      // Non-zero exit just means violations; the JSON is still on stdout.
      if (error.stdout) return { stdout: error.stdout };
      throw error;
    });
    const byFile = new Map<string, Diagnostic[]>(
      Object.keys(files).map((path) => [path, []]),
    );
    for (const d of JSON.parse(stdout).diagnostics) {
      // Parse errors and plugin crashes have no rule code. Swallowing them
      // would make every "allows" case pass vacuously.
      if (!d.code) throw new Error(`${d.filename}: ${d.message}`);
      const rule = String(d.code).replace(/^(.+)\((.+)\)$/, "$1/$2");
      byFile.get(d.filename)?.push({ rule, message: d.message });
    }
    return byFile;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
