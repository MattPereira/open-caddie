import { generateText, Output, type LanguageModelUsage } from "ai";
import { z } from "zod";

import {
  DEFAULT_SCORECARD_MODEL,
  getGoogleGenerativeAIScorecardModel,
  withGoogleGenerativeAIScorecardFallback,
} from "@/lib/ai/scorecard";

export const ScorecardSchema = z.object({
  tees: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "Tee set name exactly as printed, e.g. 'Blue' or 'Championship'.",
          ),
        color: z
          .string()
          .trim()
          .toLowerCase()
          .max(30)
          .describe(
            "Lowercase color label if the scorecard indicates one; omit if ambiguous.",
          )
          .optional(),
        rating: z
          .number()
          .optional()
          .describe(
            "USGA Course Rating for this tee. OMIT if not clearly visible on the scorecard image — do not guess.",
          ),
        slope: z
          .number()
          .int()
          .optional()
          .describe(
            "USGA Slope Rating (55-155) for this tee. OMIT if not clearly visible — do not guess.",
          ),
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

export type Scorecard = z.infer<typeof ScorecardSchema>;

export const SYSTEM_PROMPT = `You extract structured data from cropped photos of printed golf scorecards.

GENERAL RULES
- Read values exactly as printed; do not infer or fix apparent typos.
- Output JSON matching the schema exactly. Omit color when uncertain.

TEE ROWS
- Tees are rows (or columns) labeled by color/name (Black, Blue, White, Gold, Red, etc.). Capture every tee set with 18 yardages and a rating/slope.
- IMPORTANT: each tee row has its own yardages on every hole. Never copy yardages from one tee row to another. If a row's value is unreadable, return your best guess for that single cell — do not fill it with the row above or below.
- Rating/slope are usually printed as "RATING/SLOPE" or "R/S", e.g. "70.0/127". If the card shows combined men's/women's like "M 66.4/115 W 72.1/121", use the men's (M) value. If only one rating is shown, use it as-is.
- Many scorecards print rating/slope on the back of the card or on a separate panel that is NOT visible in this image. If you cannot clearly see a rating or slope for a tee row, OMIT the field entirely. Do not copy from another tee, do not guess, do not invent a plausible value. Leaving the field out is the correct behavior when the value is not in the image.

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

export const USER_PROMPT =
  "Parse this scorecard. Return every tee set (name, color if shown, rating, slope, 18 yardages) and per-hole par + handicap.";

function sum(ns: number[]) {
  return ns.reduce((a, b) => a + b, 0);
}

export type ScorecardWarning = { scope: "hole" | "tee"; message: string };

export function verifySums(parsed: Scorecard): ScorecardWarning[] {
  const issues: ScorecardWarning[] = [];
  const pars = parsed.holes.map((h) => h.par);
  const outPar = sum(pars.slice(0, 9));
  const inPar = sum(pars.slice(9, 18));
  if (outPar !== parsed.printedOutPar)
    issues.push({ scope: "hole", message: `par OUT: summed ${outPar} vs printed ${parsed.printedOutPar}` });
  if (inPar !== parsed.printedInPar)
    issues.push({ scope: "hole", message: `par IN: summed ${inPar} vs printed ${parsed.printedInPar}` });
  if (outPar + inPar !== parsed.printedTotalPar)
    issues.push({
      scope: "hole",
      message: `par TOT: summed ${outPar + inPar} vs printed ${parsed.printedTotalPar}`,
    });
  for (const tee of parsed.tees) {
    const out = sum(tee.yardages.slice(0, 9));
    const i = sum(tee.yardages.slice(9, 18));
    if (out !== tee.printedOutYards)
      issues.push({
        scope: "tee",
        message: `${tee.name} OUT yards: summed ${out} vs printed ${tee.printedOutYards}`,
      });
    if (i !== tee.printedInYards)
      issues.push({
        scope: "tee",
        message: `${tee.name} IN yards: summed ${i} vs printed ${tee.printedInYards}`,
      });
    if (out + i !== tee.printedTotalYards)
      issues.push({
        scope: "tee",
        message: `${tee.name} TOT yards: summed ${out + i} vs printed ${tee.printedTotalYards}`,
      });
  }
  const sis = parsed.holes.map((h) => h.handicap).sort((a, b) => a - b);
  const expected = Array.from({ length: 18 }, (_, i) => i + 1);
  if (sis.join(",") !== expected.join(","))
    issues.push({ scope: "hole", message: `handicap not 1-18 unique: got [${sis.join(",")}]` });
  return issues;
}

export type ParseScorecardResult = {
  parsed: Scorecard;
  sumChecks: ScorecardWarning[];
  usage: LanguageModelUsage;
  finishReason: string;
};

export async function parseScorecardImage(
  buffer: Uint8Array | Buffer,
  mediaType: string,
  model: string = DEFAULT_SCORECARD_MODEL,
): Promise<ParseScorecardResult> {
  const result = await withGoogleGenerativeAIScorecardFallback(
    () =>
      generateText({
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
              { type: "file", data: buffer, mediaType },
            ],
          },
        ],
      }),
    () =>
      generateText({
        model: getGoogleGenerativeAIScorecardModel(model),
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
              { type: "file", data: buffer, mediaType },
            ],
          },
        ],
      }),
  );

  const parsed: Scorecard = result.output;
  return {
    parsed,
    sumChecks: verifySums(parsed),
    usage: result.usage,
    finishReason: result.finishReason,
  };
}
