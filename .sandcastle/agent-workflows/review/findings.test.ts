import { describe, expect, it } from "vitest";
import { addFindings, type Findings } from "./findings";
import type { ReviewComment, ReviewFix } from "./review-schema";

const finding = (overrides: Partial<ReviewComment>): ReviewComment => ({
  axis: "standards",
  title: "Server module imports a UI component",
  path: "app/modules/a/lib/b.server.ts",
  line: 4,
  body: "**Wrong direction.**\n\nMove the type.",
  ...overrides,
});

const fix = (overrides: Partial<ReviewFix>): ReviewFix => ({
  axis: "standards",
  title: "Duplicated lookup",
  commit: "430ae60",
  rule: "Duplicated Code",
  ...overrides,
});

const findings = (overrides: Partial<Findings>): Findings => ({
  fixed: [],
  posted: [],
  dropped: [],
  ...overrides,
});

const verdict = [
  "## Standards: CHANGES REQUESTED",
  "One line.",
  "",
  "## Spec: PASS",
  "Met.",
  "",
  "## Rules this review wanted and could not find",
  "- None.",
  "",
].join("\n");

describe("addFindings", () => {
  it("gives both axes an empty Fixed and Left list when there are no findings", () => {
    const result = addFindings(verdict, findings({}));

    expect(result).toContain(
      "One line.\n\n**Fixed**\n\nNone.\n\n**Left**\n\nNone.\n\n## Spec: PASS",
    );
    expect(result).toContain(
      "Met.\n\n**Fixed**\n\nNone.\n\n**Left**\n\nNone.\n\n## Rules",
    );
  });

  it("lists a fix by title, commit and rule", () => {
    const result = addFindings(verdict, findings({ fixed: [fix({})] }));

    expect(result).toContain(
      "One line.\n\n**Fixed**\n\n- **Duplicated lookup**, in 430ae60: Duplicated Code\n\n**Left**\n\nNone.\n\n## Spec",
    );
  });

  it("lists an inline finding by title and line only", () => {
    const result = addFindings(verdict, findings({ posted: [finding({})] }));

    expect(result).toContain(
      "**Left**\n\n- **Server module imports a UI component**, at `app/modules/a/lib/b.server.ts:4`\n\n## Spec: PASS",
    );
    expect(result).not.toContain("Move the type.");
  });

  it("writes a dropped finding out in full, indented under its entry", () => {
    const result = addFindings(verdict, findings({ dropped: [finding({})] }));

    expect(result).toContain(
      "- **Server module imports a UI component**, at `app/modules/a/lib/b.server.ts:4`\n\n  **Wrong direction.**\n\n  Move the type.\n\n## Spec: PASS",
    );
  });

  it("puts each finding under its own axis", () => {
    const result = addFindings(
      verdict,
      findings({
        fixed: [fix({ axis: "spec", title: "Missed criterion" })],
        posted: [finding({ axis: "spec", title: "Scope creep" })],
      }),
    );

    expect(result).toContain(
      "One line.\n\n**Fixed**\n\nNone.\n\n**Left**\n\nNone.\n\n## Spec",
    );
    expect(result).toContain(
      "Met.\n\n**Fixed**\n\n- **Missed criterion**, in 430ae60: Duplicated Code\n\n**Left**\n\n- **Scope creep**, at `app/modules/a/lib/b.server.ts:4`\n\n## Rules",
    );
  });

  it("lists inline findings before dropped ones", () => {
    const result = addFindings(
      verdict,
      findings({
        posted: [finding({ title: "Inline" })],
        dropped: [finding({ title: "Dropped" })],
      }),
    );

    expect(result.indexOf("**Inline**")).toBeLessThan(
      result.indexOf("**Dropped**"),
    );
  });

  it("adds the axis heading when the verdict has none", () => {
    const result = addFindings(
      "No verdict.\n",
      findings({ posted: [finding({})] }),
    );

    expect(result).toBe(
      "No verdict.\n\n## Standards\n\n**Fixed**\n\nNone.\n\n**Left**\n\n- **Server module imports a UI component**, at `app/modules/a/lib/b.server.ts:4`\n",
    );
  });

  it("adds nothing to a verdict with no sections and no findings", () => {
    expect(addFindings("No verdict.\n", findings({}))).toBe("No verdict.\n");
  });
});
