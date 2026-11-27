// @ts-check
// Finds files by their React directive ("use client", "use server"). The
// directive marks a bundle boundary, so .dependency-cruiser.runtime.cjs uses
// it rather than folder names: not every file in a components folder is a
// client component, and client components live outside them too.

/* oxlint-disable typescript/no-require-imports -- CJS, for the depcruise config */
const { readdirSync, readFileSync } = require("node:fs");

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
// A directive is only a directive in the prologue: before any other statement,
// though comments and other directives may come first.
const PROLOGUE_ITEM =
  /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/|(["'])([^"'\n]*)\1\s*;?)/;

/**
 * @param {string} source
 * @param {string} directive e.g. "use client"
 */
function hasDirective(source, directive) {
  let rest = source;
  for (;;) {
    const match = PROLOGUE_ITEM.exec(rest);
    if (!match) return false;
    if (match[2] === directive) return true;
    rest = rest.slice(match[0].length);
  }
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE.test(entry.name) ? [path] : [];
  });
}

/**
 * Every source file under `dir` whose prologue holds `directive`, as
 * `dir`-prefixed forward-slash paths, the form dependency-cruiser reports.
 * @param {string} dir
 * @param {string} directive
 */
function filesWithDirective(dir, directive) {
  return sourceFiles(dir).filter((path) =>
    hasDirective(String(readFileSync(path)), directive),
  );
}

/**
 * A regex source matching exactly these paths, for a dependency-cruiser rule.
 * Matches nothing when `paths` is empty.
 * @param {string[]} paths
 */
function exactPaths(paths) {
  const escaped = paths.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return `^(${escaped.join("|")})$`;
}

module.exports = { hasDirective, filesWithDirective, exactPaths };
