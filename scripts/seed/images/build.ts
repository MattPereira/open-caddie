import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { COURSE_PLANS, type CoursePlan } from "../world/course-data";
import { CLUB_IMAGES, COURSE_IMAGES, PLAYER_IMAGES } from "../world/image-data";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = join(root, "public/seed");
const raw = resolve(process.argv[2] ?? join(root, "scripts/seed/images/raw"));

const groups = [
  { images: PLAYER_IMAGES, width: 256, height: 256, maxBytes: 30 * 1024 },
  { images: COURSE_IMAGES, width: 1600, height: 600, maxBytes: 200_000 },
  { images: CLUB_IMAGES, width: 512, height: 512, maxBytes: 120 * 1024 },
];

for (const { images, width, height, maxBytes } of groups) {
  for (const url of Object.values(images).filter(Boolean)) {
    const target = join(root, "public", url);
    const input = join(raw, basename(url, ".webp") + ".png");
    const source = await readFile(input);
    let encoded: Buffer | undefined;
    for (let quality = 82; quality >= 30; quality -= 4) {
      encoded = await sharp(source)
        .rotate()
        .resize(width, height, { fit: "cover", position: "centre" })
        .webp({ quality, effort: 6 })
        .toBuffer();
      if (encoded.length <= maxBytes) break;
    }
    if (!encoded || encoded.length > maxBytes) {
      throw new Error(`${url} exceeds ${maxBytes} bytes`);
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, encoded);
    console.log(`${url}: ${encoded.length} bytes`);
  }
}

for (const plan of Object.values(COURSE_PLANS)) {
  const target = join(output, "courses", `${plan.handle}-scorecard.svg`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, scorecard(plan));
}

const bytes = await directoryBytes(output);
if (bytes > 3_000_000) throw new Error(`Seed assets exceed 3 MB: ${bytes}`);
console.log(`Seed assets: ${bytes} / 3000000 bytes`);

function escapeXml(value: string | number) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char] ?? char,
  );
}

function totals(values: number[]) {
  const sum = (part: number[]) => part.reduce((a, b) => a + b, 0);
  return [sum(values.slice(0, 9)), sum(values.slice(9)), sum(values)];
}

function scorecard(plan: CoursePlan) {
  const widths = [210, ...Array<number>(18).fill(60), 80, 80, 90, 100, 100];
  const tableWidth = widths.reduce((a, b) => a + b, 0);
  const width = tableWidth + 48;
  const rows: (string | number)[][] = [
    [
      "Hole",
      ...Array.from({ length: 18 }, (_, i) => i + 1),
      "Out",
      "In",
      "Total",
      "Rating",
      "Slope",
    ],
    ...plan.tees.map((tee) => [
      tee.name,
      ...tee.yardages,
      ...totals(tee.yardages),
      tee.rating,
      tee.slope,
    ]),
    ["Par", ...plan.pars, ...totals(plan.pars), "", ""],
    ["Stroke index", ...plan.handicaps, "", "", "", "", ""],
  ];
  const height = 168 + rows.length * 46;
  const table = rows
    .map((row, rowIndex) => {
      let x = 24;
      const y = 100 + rowIndex * 46;
      return row
        .map((value, col) => {
          const cellWidth = widths[col];
          const header = rowIndex === 0;
          const fill = header
            ? "#234c3c"
            : rowIndex % 2
              ? "#f3efdf"
              : "#fffdf5";
          const text = header ? "#fffdf5" : "#234c3c";
          const cell = `<rect x="${x}" y="${y}" width="${cellWidth}" height="46" fill="${fill}" stroke="#d4d5c3"/><text x="${col ? x + cellWidth / 2 : x + 14}" y="${y + 29}" text-anchor="${col ? "middle" : "start"}" fill="${text}" font-size="18">${escapeXml(value)}</text>`;
          x += cellWidth;
          return cell;
        })
        .join("");
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(plan.name)} — seed scorecard</title>
<desc id="desc">Yardages, pars, stroke indexes, men's ratings and slopes from the seeded course snapshot. An original reference layout, not an official course card.</desc>
<rect width="100%" height="100%" fill="#fffdf5"/>
<g font-family="Arial, sans-serif"><text x="24" y="42" font-size="28" font-weight="bold" fill="#234c3c">${escapeXml(plan.name)}</text>
<text x="24" y="73" font-size="18" fill="#526354">Seed reference • Yardages in yards • Men's ratings • Original layout</text>
${table}
<text x="24" y="${height - 28}" font-size="16" fill="#526354">Seed snapshot, not an official card. Sources and limitations: docs/seed/course-sources.md</text></g>
</svg>\n`;
}

async function directoryBytes(path: string): Promise<number> {
  let bytes = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    bytes += entry.isDirectory()
      ? await directoryBytes(child)
      : (await stat(child)).size;
  }
  return bytes;
}
