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
import { generateText, Output } from "ai";
import { z } from "zod";

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

const TeeColor = z.enum([
  "red",
  "white",
  "blue",
  "gold",
  "black",
  "green",
  "silver",
]);

const ScorecardSchema = z.object({
  tees: z
    .array(
      z.object({
        name: z
          .string()
          .describe("Tee set name exactly as printed, e.g. 'Blue' or 'Championship'."),
        color: TeeColor.optional().describe(
          "Lowercase color label if the scorecard indicates one; omit if ambiguous.",
        ),
        rating: z.number().describe("USGA Course Rating for this tee."),
        slope: z.number().int().describe("USGA Slope Rating (55-155) for this tee."),
        yardages: z
          .array(z.number().int())
          .length(18)
          .describe("Yardage per hole, holes 1-18 in order."),
        printedOutYards: z
          .number()
          .int()
          .describe("OUT column total for this tee, exactly as printed."),
        printedInYards: z
          .number()
          .int()
          .describe("IN column total for this tee, exactly as printed."),
        printedTotalYards: z
          .number()
          .int()
          .describe("TOT/TOTAL column for this tee, exactly as printed."),
      }),
    )
    .min(1),
  holes: z
    .array(
      z.object({
        hole: z.number().int().min(1).max(18),
        par: z.number().int().min(3).max(6),
        handicap: z
          .number()
          .int()
          .min(1)
          .max(18)
          .describe(
            "Stroke index / handicap for this hole, 1-18 unique across holes.",
          ),
      }),
    )
    .length(18),
  printedOutPar: z.number().int().describe("OUT par total exactly as printed."),
  printedInPar: z.number().int().describe("IN par total exactly as printed."),
  printedTotalPar: z
    .number()
    .int()
    .describe("TOT/TOTAL par exactly as printed."),
});

type Scorecard = z.infer<typeof ScorecardSchema>;

const SYSTEM_PROMPT = `You extract structured data from cropped photos of printed golf scorecards.

GENERAL RULES
- Read values exactly as printed; do not infer or fix apparent typos.
- Output JSON matching the schema exactly. Omit color when uncertain.

TEE ROWS
- Tees are rows (or columns) labeled by color/name (Black, Blue, White, Gold, Red, etc.). Capture every tee set with 18 yardages and a rating/slope.
- IMPORTANT: each tee row has its own yardages on every hole. Never copy yardages from one tee row to another. If a row's value is unreadable, return your best guess for that single cell — do not fill it with the row above or below.
- Rating/slope are usually printed as "RATING/SLOPE" or "R/S", e.g. "70.0/127". If the card shows combined men's/women's like "M 66.4/115 W 72.1/121", use the men's (M) value. If only one rating is shown, use it as-is.

PAR AND HANDICAP (shared across all tees)
- The "Handicap" or "HCP" row gives each hole a stroke index 1-18 (1 = hardest). The 18 values must be unique and cover 1-18 exactly once. If both Men's and Women's handicap rows are shown, use the Men's Handicap row.
- Do not confuse the stroke-index column with player-score columns.

COLUMN LAYOUT — READ CAREFULLY
- Holes 1-9 are followed by an OUT total column. Holes 10-18 follow OUT and are followed by an IN total, then TOT (or TOTAL).
- Some cards insert a vertical "INITIAL" or "ATTEST" divider column between hole 9 (or OUT) and hole 10. This divider is NOT a hole and NOT a total — skip it entirely. Do not let it shift your column alignment.
- The columns to the right of TOT (e.g. HCP, NET, ADJ, Rating/Slope) are NOT hole yardages or par values. Do not include them in the 18 hole values or in the OUT/IN/TOT totals.
- Sanity check before answering: OUT (holes 1-9 sum) + IN (holes 10-18 sum) should equal TOT for every tee and for par. If your numbers don't satisfy this, re-read the card before answering — most likely you skipped or shifted a column.

STACKED NUMBERS IN A CELL
- If a single tee's cell shows two yardages stacked vertically (alternate tee marker positions), use the LARGER of the two numbers — these scorecards default to the back position of the alternate marker.
- Never concatenate stacked numbers (e.g. "196" over "167" is two separate values, not "196167").`;

const USER_PROMPT =
  "Parse this scorecard. Return every tee set (name, color if shown, rating, slope, 18 yardages) and per-hole par + handicap.";

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

function sum(ns: number[]) {
  return ns.reduce((a, b) => a + b, 0);
}

function verifySums(parsed: Scorecard): string[] {
  const issues: string[] = [];
  const pars = parsed.holes.map((h) => h.par);
  const outPar = sum(pars.slice(0, 9));
  const inPar = sum(pars.slice(9, 18));
  if (outPar !== parsed.printedOutPar)
    issues.push(`par OUT: summed ${outPar} vs printed ${parsed.printedOutPar}`);
  if (inPar !== parsed.printedInPar)
    issues.push(`par IN: summed ${inPar} vs printed ${parsed.printedInPar}`);
  if (outPar + inPar !== parsed.printedTotalPar)
    issues.push(
      `par TOT: summed ${outPar + inPar} vs printed ${parsed.printedTotalPar}`,
    );
  for (const tee of parsed.tees) {
    const out = sum(tee.yardages.slice(0, 9));
    const i = sum(tee.yardages.slice(9, 18));
    if (out !== tee.printedOutYards)
      issues.push(`${tee.name} OUT yards: summed ${out} vs printed ${tee.printedOutYards}`);
    if (i !== tee.printedInYards)
      issues.push(`${tee.name} IN yards: summed ${i} vs printed ${tee.printedInYards}`);
    if (out + i !== tee.printedTotalYards)
      issues.push(
        `${tee.name} TOT yards: summed ${out + i} vs printed ${tee.printedTotalYards}`,
      );
  }
  const sis = parsed.holes.map((h) => h.handicap).sort((a, b) => a - b);
  const expected = Array.from({ length: 18 }, (_, i) => i + 1);
  if (sis.join(",") !== expected.join(","))
    issues.push(`handicap not 1-18 unique: got [${sis.join(",")}]`);
  return issues;
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
  const result = await generateText({
    model,
    output: Output.object({
      schema: ScorecardSchema,
      name: "Scorecard",
      description:
        "Structured contents of a printed golf scorecard: tee sets and per-hole par/handicap.",
    }),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: USER_PROMPT },
          { type: "file", data: bytes, mediaType },
        ],
      },
    ],
  });
  const elapsedMs = Date.now() - started;

  const parsed: Scorecard = result.output;
  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const costUsd = estimateCostUsd(model, inputTokens, outputTokens);
  const costStr = costUsd != null ? fmtUsd(costUsd) : "n/a (no price)";
  console.error(
    `  ${elapsedMs} ms | in=${inputTokens} out=${outputTokens} | ~${costStr} | finish=${result.finishReason}`,
  );

  const checks = verifySums(parsed);
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
