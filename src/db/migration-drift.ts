export type AppliedMigration = { createdAt: number; hash: string };
export type RepoMigration = { tag: string; when: number; hash: string };
export type MigrationDrift =
  | { kind: "edited"; tag: string }
  | { kind: "missing"; createdAt: number }
  | { kind: "skipped"; tag: string };

// Drizzle's migrator matches by timestamp alone: it applies only repo
// migrations newer than the newest applied one and never compares hashes.
// Each kind here is a change it would silently ignore. A `baseline:<tag>` hash
// is a row inserted by hand to mark the prod schema snapshot as applied.
export function findMigrationDrift(
  applied: AppliedMigration[],
  repo: RepoMigration[],
): MigrationDrift[] {
  const repoByWhen = new Map(repo.map((m) => [m.when, m]));
  const appliedWhens = new Set(applied.map((row) => row.createdAt));
  const newestApplied = Math.max(...appliedWhens);
  const drift: MigrationDrift[] = [];
  for (const row of applied) {
    const file = repoByWhen.get(row.createdAt);
    if (!file) {
      drift.push({ kind: "missing", createdAt: row.createdAt });
    } else if (![file.hash, `baseline:${file.tag}`].includes(row.hash)) {
      drift.push({ kind: "edited", tag: file.tag });
    }
  }
  for (const file of repo) {
    if (!appliedWhens.has(file.when) && file.when < newestApplied) {
      drift.push({ kind: "skipped", tag: file.tag });
    }
  }
  return drift;
}
