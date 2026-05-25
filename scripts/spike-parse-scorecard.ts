/**
 * Spike: parse a printed course scorecard image with a vision LLM.
 *
 * Usage:
 *   pnpm tsx scripts/spike-parse-scorecard.ts <path-to-image> [--model <id>]
 *
 * Routes through the Vercel AI Gateway. Requires VERCEL_OIDC_TOKEN in
 * .env.local (run `vercel env pull` to refresh — token lives ~24h).
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { parseScorecardImage } from "../lib/course-scorecard-parser";

const DEFAULT_MODEL = "anthropic/claude-haiku-4-5";

// Rough USD-per-million-token prices for cost estimation. The AI Gateway
// dashboard is authoritative; this just gives an at-a-glance signal during the
// spike so we can compare models without leaving the terminal.
const PRICES: Record<string, { in: number; out: number }> = {
  "anthropic/claude-haiku-4-5": { in: 1, out: 5 },
  "anthropic/claude-sonnet-4-6": { in: 3, out: 15 },
  "anthropic/claude-opus-4-7": { in: 15, out: 75 },
  "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "google/gemini-3.1-flash-lite": { in: 0.25, out: 1.5 },
};

function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(5)}`;
}

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: pnpm tsx scripts/spike-parse-scorecard.ts <path-to-image-or-dir> [--model <id>]",
    );
    process.exit(1);
  }
  let model = DEFAULT_MODEL;
  let inputPath: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--model") {
      model = args[++i] ?? DEFAULT_MODEL;
    } else if (!inputPath) {
      inputPath = a;
    }
  }
  if (!inputPath) {
    console.error("Missing image or directory path.");
    process.exit(1);
  }
  return { inputPath: resolve(inputPath), model };
}

async function resolveImagePaths(inputPath: string): Promise<string[]> {
  const stats = await stat(inputPath);
  if (stats.isFile()) return [inputPath];
  if (!stats.isDirectory()) {
    throw new Error(`Not a file or directory: ${inputPath}`);
  }
  const entries = await readdir(inputPath);
  return entries
    .filter((name) => MIME_BY_EXT[extname(name).toLowerCase()])
    .sort()
    .map((name) => join(inputPath, name));
}

type ParseStats = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  elapsedMs: number;
  mismatchCount: number;
};

async function parseOne(
  imagePath: string,
  model: string,
  runsDir: string,
): Promise<ParseStats> {
  const ext = extname(imagePath).toLowerCase();
  const mediaType = MIME_BY_EXT[ext];
  if (!mediaType) {
    console.error(`! Skipping (unsupported ext): ${imagePath}`);
    return {
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      elapsedMs: 0,
      mismatchCount: 0,
    };
  }

  const bytes = await readFile(imagePath);
  console.error(
    `> ${basename(imagePath)} (${(bytes.byteLength / 1024).toFixed(1)} KB) with ${model}...`,
  );

  const started = Date.now();
  const result = await parseScorecardImage(bytes, mediaType, model);
  const elapsedMs = Date.now() - started;

  const parsed = result.parsed;
  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const costUsd = estimateCostUsd(model, inputTokens, outputTokens);
  const costStr = costUsd != null ? fmtUsd(costUsd) : "n/a (no price)";
  console.error(
    `  ${elapsedMs} ms | in=${inputTokens} out=${outputTokens} | ~${costStr} | finish=${result.finishReason}`,
  );

  const checks = result.sumChecks;
  if (checks.length === 0) {
    console.error(`  sums: OK`);
  } else {
    console.error(`  sums: ${checks.length} mismatch(es)`);
    for (const c of checks) console.error(`    - ${c}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = basename(imagePath, ext).replace(/[^a-z0-9-_]+/gi, "_");
  const modelSlug = model.replace(/[^a-z0-9-_]+/gi, "_");
  const outPath = `${runsDir}/${stamp}__${slug}__${modelSlug}.json`;
  const record = {
    imagePath,
    imageBytes: bytes.byteLength,
    model,
    elapsedMs,
    usage: result.usage,
    estimatedCostUsd: costUsd,
    finishReason: result.finishReason,
    timestamp: new Date().toISOString(),
    parsed,
    sumChecks: checks,
    corrections: null,
  };
  await writeFile(outPath, JSON.stringify(record, null, 2));
  console.error(`  saved: ${outPath}`);

  return {
    inputTokens,
    outputTokens,
    costUsd,
    elapsedMs,
    mismatchCount: checks.length,
  };
}

async function main() {
  const { inputPath, model } = parseArgs();
  const imagePaths = await resolveImagePaths(inputPath);
  if (imagePaths.length === 0) {
    console.error(`No images found in ${inputPath}`);
    process.exit(1);
  }

  const modelSlug = model.replace(/[^a-z0-9-_]+/gi, "_");
  const runsDir = resolve(`scorecards/runs/${modelSlug}`);
  await mkdir(runsDir, { recursive: true });

  console.error(`Parsing ${imagePaths.length} image(s) with ${model}...`);
  console.error(`Writing records to ${runsDir}`);
  const stats: ParseStats[] = [];
  for (const p of imagePaths) {
    try {
      const s = await parseOne(p, model, runsDir);
      stats.push(s);
    } catch (err) {
      console.error(`  FAILED: ${p}\n  ${(err as Error).message}`);
    }
  }

  if (stats.length > 0) {
    const totIn = stats.reduce((a, s) => a + s.inputTokens, 0);
    const totOut = stats.reduce((a, s) => a + s.outputTokens, 0);
    const totCost = stats.reduce((a, s) => a + (s.costUsd ?? 0), 0);
    const totMs = stats.reduce((a, s) => a + s.elapsedMs, 0);
    const totMismatches = stats.reduce((a, s) => a + s.mismatchCount, 0);
    const cleanCount = stats.filter((s) => s.mismatchCount === 0).length;
    const avgCost = totCost / stats.length;
    const projected1000 = avgCost * 1000;

    console.error(`\n=== Session summary (${model}) ===`);
    console.error(`images:        ${stats.length}`);
    console.error(`clean parses:  ${cleanCount}/${stats.length} (no sum mismatches)`);
    console.error(`total tokens:  in=${totIn} out=${totOut}`);
    console.error(`total time:    ${(totMs / 1000).toFixed(1)} s`);
    console.error(`total cost:    ~${fmtUsd(totCost)}`);
    console.error(`avg cost/img:  ~${fmtUsd(avgCost)}`);
    console.error(`@ 1000 parses: ~${fmtUsd(projected1000)}`);
    console.error(`total mismatches across all images: ${totMismatches}`);
  }

  console.error(`Records in ${runsDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
