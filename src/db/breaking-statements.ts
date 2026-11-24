// Statements the code live in prod may not survive: Vercel migrates before the
// new code is live (ADR 0006). See the database-migrations skill.
const KINDS = [
  ["drop-table", /\bDROP\s+TABLE\b/i],
  ["drop-column", /\bDROP\s+COLUMN\b/i],
  ["rename", /\bRENAME\b/i],
  ["change-type", /\bALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE\b/i],
  ["set-not-null", /\bSET\s+NOT\s+NULL\b/i],
  ["drop-default", /\bDROP\s+DEFAULT\b/i],
] as const;

export type BreakingStatement = {
  kind: (typeof KINDS)[number][0];
  statement: string;
};

const DEPLOY_SAFE = /^\s*--\s*deploy-safe:\s*\S/;

export function findBreakingStatements(sql: string): BreakingStatement[] {
  const found: BreakingStatement[] = [];
  let statement = "";
  let deploySafe = false;

  const flush = () => {
    const text = statement.replace(/\s+/g, " ").trim();
    if (text && !deploySafe) {
      for (const [kind, pattern] of KINDS) {
        if (pattern.test(text)) found.push({ kind, statement: text });
      }
    }
    deploySafe = false;
  };

  for (const line of sql.split("\n")) {
    // Comments are read whole before splitting on `;`, so a reason may hold one.
    if (DEPLOY_SAFE.test(line)) {
      deploySafe = true;
      continue;
    }
    const [first, ...rest] = line.replace(/--.*/, "").split(";");
    statement += ` ${first}`;
    for (const part of rest) {
      flush();
      statement = part;
    }
  }
  flush();
  return found;
}
