#!/usr/bin/env node
// Guard: rejects CSS custom properties outside the shadcn theme. A hand-made
// token needs its own value tuned per theme; the shadcn tokens are tuned already.
// Usage: node scripts/check-theme-tokens.mjs [file.css...]  (default: src/**/*.css)
import { globSync, readFileSync } from "node:fs";

const COLORS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
];

const ALLOWED = new Set([
  ...COLORS,
  ...COLORS.map((color) => `color-${color}`),
  "radius",
  ...["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"].map((s) => `radius-${s}`),
  "font-sans",
  "font-mono",
  "font-heading",
  "font-brand",
]);

const files =
  process.argv.length > 2 ? process.argv.slice(2) : globSync("src/**/*.css");

const unknown = files.flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(/^\s*--([\w-]+)\s*:/gm)]
    .map((match) => match[1])
    .filter((name) => !ALLOWED.has(name))
    .map((name) => `  ${file}  --${name}`),
);

if (unknown.length === 0) process.exit(0);

console.error(`
CSS custom properties outside the shadcn theme:

${[...new Set(unknown)].join("\n")}

Compose the color from existing tokens instead, lightened with an opacity
modifier: bg-primary/10, bg-muted, bg-accent, text-muted-foreground. Each is
tuned for light and dark already. A new token is a decision for a person:
remove it and say in the PR body which built-in class came closest and why it
fell short.
`);
process.exit(1);
