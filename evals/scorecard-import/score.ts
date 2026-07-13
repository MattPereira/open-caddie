/**
 * Compare model runs in `evals/scorecard-import/runs/<model>/` against the verified
 * truth files in `evals/scorecard-import/expected/`. Prints per-card and per-model
 * accuracy.
 *
 * Usage:
 *   pnpm tsx evals/scorecard-import/score.ts
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

type Tee = {
  name: string;
  color?: string;
  rating: number;
  slope: number;
  yardages: number[];
  printedOutYards: number;
  printedInYards: number;
  printedTotalYards: number;
};
type Hole = { hole: number; par: number; handicap: number };
type Scorecard = {
  tees: Tee[];
  holes: Hole[];
  printedOutPar: number;
  printedInPar: number;
  printedTotalPar: number;
};

type Diff = { field: string; expected: unknown; actual: unknown };

function diffTeeByName(exp: Tee, act: Tee | undefined, prefix: string): Diff[] {
  const diffs: Diff[] = [];
  if (!act) {
    diffs.push({ field: `${prefix}.<missing>`, expected: exp.name, actual: undefined });
    return diffs;
  }
  if (act.rating !== exp.rating)
    diffs.push({ field: `${prefix}.rating`, expected: exp.rating, actual: act.rating });
  if (act.slope !== exp.slope)
    diffs.push({ field: `${prefix}.slope`, expected: exp.slope, actual: act.slope });
  if ((act.color ?? null) !== (exp.color ?? null))
    diffs.push({ field: `${prefix}.color`, expected: exp.color ?? null, actual: act.color ?? null });
  for (let i = 0; i < 18; i++) {
    if (act.yardages[i] !== exp.yardages[i])
      diffs.push({
        field: `${prefix}.yardages[${i + 1}]`,
        expected: exp.yardages[i],
        actual: act.yardages[i],
      });
  }
  if (act.printedOutYards !== exp.printedOutYards)
    diffs.push({
      field: `${prefix}.printedOutYards`,
      expected: exp.printedOutYards,
      actual: act.printedOutYards,
    });
  if (act.printedInYards !== exp.printedInYards)
    diffs.push({
      field: `${prefix}.printedInYards`,
      expected: exp.printedInYards,
      actual: act.printedInYards,
    });
  if (act.printedTotalYards !== exp.printedTotalYards)
    diffs.push({
      field: `${prefix}.printedTotalYards`,
      expected: exp.printedTotalYards,
      actual: act.printedTotalYards,
    });
  return diffs;
}

function diffScorecard(expected: Scorecard, actual: Scorecard): Diff[] {
  const diffs: Diff[] = [];

  const expByName = new Map(expected.tees.map((t) => [t.name, t]));
  const actByName = new Map(actual.tees.map((t) => [t.name, t]));

  for (const exp of expected.tees) {
    const act = actByName.get(exp.name);
    if (!act) {
      diffs.push({ field: `tees[${exp.name}]`, expected: "present", actual: "missing" });
      continue;
    }
    diffs.push(...diffTeeByName(exp, act, `tees[${exp.name}]`));
  }
  for (const act of actual.tees) {
    if (!expByName.has(act.name))
      diffs.push({ field: `tees[${act.name}]`, expected: "absent", actual: "present (extra)" });
  }

  for (let i = 0; i < 18; i++) {
    const e = expected.holes[i];
    const a = actual.holes[i];
    if (!a) {
      diffs.push({ field: `holes[${i + 1}]`, expected: "present", actual: "missing" });
      continue;
    }
    if (a.par !== e.par)
      diffs.push({ field: `holes[${i + 1}].par`, expected: e.par, actual: a.par });
    if (a.handicap !== e.handicap)
      diffs.push({ field: `holes[${i + 1}].handicap`, expected: e.handicap, actual: a.handicap });
  }

  if (actual.printedOutPar !== expected.printedOutPar)
    diffs.push({ field: "printedOutPar", expected: expected.printedOutPar, actual: actual.printedOutPar });
  if (actual.printedInPar !== expected.printedInPar)
    diffs.push({ field: "printedInPar", expected: expected.printedInPar, actual: actual.printedInPar });
  if (actual.printedTotalPar !== expected.printedTotalPar)
    diffs.push({ field: "printedTotalPar", expected: expected.printedTotalPar, actual: actual.printedTotalPar });

  return diffs;
}

function countFields(expected: Scorecard): number {
  let n = 0;
  for (let i = 0; i < expected.tees.length; i++) {
    n += 3; // rating, slope, color
    n += 18; // yardages
    n += 3; // printed out/in/total
  }
  n += 18 * 2; // par + handicap
  n += 3; // par totals
  return n;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function latestRunPerImage(modelDir: string): Promise<Map<string, string>> {
  const files = await readdir(modelDir);
  // filenames: <stamp>__<image-slug>__<model-slug>.json
  const byImage = new Map<string, string>();
  for (const f of files.sort()) {
    const m = f.match(/^([^_]+(?:_[^_]+)*?)__(.+)__([^_]+(?:_[^_]+)*)\.json$/);
    if (!m) continue;
    const imageSlug = m[2];
    byImage.set(imageSlug, join(modelDir, f)); // last in sorted order = newest
  }
  return byImage;
}

async function main() {
  const expectedDir = resolve("evals/scorecard-import/expected");
  const runsRoot = resolve("evals/scorecard-import/runs");

  const expectedFiles = (await readdir(expectedDir)).filter((f) => f.endsWith(".json"));
  if (expectedFiles.length === 0) {
    console.error(`No truth files in ${expectedDir}`);
    process.exit(1);
  }
  const expected = new Map<string, Scorecard>();
  for (const f of expectedFiles) {
    const slug = basename(f, ".json").replace(/[^a-z0-9-_]+/gi, "_");
    expected.set(slug, await readJson<Scorecard>(join(expectedDir, f)));
  }

  const modelDirs = (await readdir(runsRoot)).filter(async (d) => {
    return (await stat(join(runsRoot, d))).isDirectory();
  });

  console.log(`Expected: ${expected.size} cards from ${expectedDir}`);
  console.log(`Models:   ${modelDirs.length} in ${runsRoot}\n`);

  for (const model of modelDirs) {
    const modelDir = join(runsRoot, model);
    const runs = await latestRunPerImage(modelDir);
    let totalFields = 0;
    let totalDiffs = 0;
    const perCard: { image: string; fields: number; diffs: number; diffList: Diff[] }[] = [];

    for (const [slug, exp] of expected) {
      const runPath = runs.get(slug);
      if (!runPath) {
        perCard.push({ image: slug, fields: countFields(exp), diffs: -1, diffList: [] });
        continue;
      }
      const record = await readJson<{ parsed: Scorecard }>(runPath);
      const diffs = diffScorecard(exp, record.parsed);
      const fields = countFields(exp);
      totalFields += fields;
      totalDiffs += diffs.length;
      perCard.push({ image: slug, fields, diffs: diffs.length, diffList: diffs });
    }

    const acc = totalFields > 0 ? ((totalFields - totalDiffs) / totalFields) * 100 : 0;
    console.log(`=== ${model} ===`);
    console.log(`overall accuracy: ${acc.toFixed(2)}% (${totalFields - totalDiffs}/${totalFields} fields correct)`);
    console.log();
    for (const r of perCard) {
      if (r.diffs < 0) {
        console.log(`  ${r.image}: NO RUN`);
        continue;
      }
      const cardAcc = ((r.fields - r.diffs) / r.fields) * 100;
      console.log(`  ${r.image}: ${cardAcc.toFixed(1)}% (${r.fields - r.diffs}/${r.fields})  — ${r.diffs} diff(s)`);
      for (const d of r.diffList) {
        console.log(`    ${d.field}: expected=${JSON.stringify(d.expected)} actual=${JSON.stringify(d.actual)}`);
      }
    }
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
