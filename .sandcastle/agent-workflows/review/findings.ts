import type { ReviewComment, ReviewFix } from "./review-schema";

const HEADINGS = { standards: "## Standards", spec: "## Spec" } as const;

export type Findings = {
  fixed: ReviewFix[];
  // Left, and posted as inline comments.
  posted: ReviewComment[];
  // Left, but outside the diff, so GitHub would not take them inline.
  dropped: ReviewComment[];
};

const indent = (text: string): string =>
  text
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n");

const fixedEntry = (fix: ReviewFix): string =>
  `- **${fix.title}**, in ${fix.commit}: ${fix.rule}`;

const leftEntry = (comment: ReviewComment, inline: boolean): string => {
  const head = `- **${comment.title}**, at \`${comment.path}:${comment.line}\``;
  return inline ? head : `${head}\n\n${indent(comment.body)}`;
};

const list = (label: string, entries: string[]): string =>
  [`**${label}**`, "", ...(entries.length ? entries : ["None."])].join("\n");

// Each axis's section of the verdict ends with a Fixed list and a Left list,
// "None." when empty, so every verdict has the same shape. A finding left
// inline gets a single line, since its comment carries the reasoning; one
// GitHub would not take inline appears in full, because the verdict is its
// only home. With no section for an axis, the lists go at the end, but only
// when there is something to list.
export const addFindings = (
  verdict: string,
  { fixed, posted, dropped }: Findings,
): string => {
  const sections = verdict.split(/^(?=## )/m);

  for (const axis of ["standards", "spec"] as const) {
    const ofAxis = (finding: { axis: string }) => finding.axis === axis;
    const fixes = fixed.filter(ofAxis);
    const left = [
      ...posted.filter(ofAxis).map((comment) => leftEntry(comment, true)),
      ...dropped.filter(ofAxis).map((comment) => leftEntry(comment, false)),
    ];
    const lists = `${list("Fixed", fixes.map(fixedEntry))}\n\n${list("Left", left)}`;

    const index = sections.findIndex((section) =>
      section.startsWith(HEADINGS[axis]),
    );
    if (index !== -1) {
      sections[index] = `${sections[index].trimEnd()}\n\n${lists}\n\n`;
    } else if (fixes.length || left.length) {
      sections.push(`\n${HEADINGS[axis]}\n\n${lists}\n`);
    }
  }

  return sections.join("").trimEnd() + "\n";
};
