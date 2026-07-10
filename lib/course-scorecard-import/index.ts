import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  courseHoles,
  courseScorecardImports,
  courseTees,
  courses,
  teeYardages,
  users,
} from "@/db/schema";
import type { Scorecard } from "@/lib/ai/course-scorecard-parser";
import { courseHandleFromName } from "@/lib/course-handle";

const IMPORT_DOCUMENT_VERSION = 1;
const IMPORT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

type ParsedTee = Pick<Scorecard["tees"][number], "name" | "color" | "rating" | "slope" | "yardages">;
type ParsedHole = Scorecard["holes"][number];
export type TeeCorrection = {
  name?: string;
  color?: string;
  rating?: number;
  slope?: number;
  yardages?: number[];
};
export type HoleCorrection = { hole?: number; par?: number; handicap?: number };

type ImportDocument = {
  version: typeof IMPORT_DOCUMENT_VERSION;
  name: string;
  tees: ParsedTee[];
  holes: ParsedHole[];
  warnings: string[];
  acknowledgedWarnings: string[];
  excludedTeeIndexes: number[];
  parseFailed: boolean;
  audit: Array<{ event: "started" | "resolved" | "retried" | "retry_failed" | "published" | "cancelled"; actorId: string; at: string }>;
};

export type CourseScorecardImportView = {
  id: string;
  status: "paused" | "published" | "cancelled";
  revision: number;
  expiresAt: Date | null;
  target: { kind: "new"; name: string; handle: string };
  parsed: {
    tees: Array<ParsedTee & { id: string; excluded: boolean }>;
    holes: Array<ParsedHole & { id: string }>;
  };
  proposedMatches: [];
  allowedIntents: Array<"resolve" | "cancel" | "retry_parsing">;
  prompts: Array<
    | { id: string; kind: "tee_metadata"; teeIndex: number; teeName: string }
    | { id: string; kind: "tee_validation"; teeIndex: number; teeName: string }
    | { id: string; kind: "hole_validation"; holeIndex: number }
    | { id: "course:holes:validation"; kind: "course_holes_validation" }
    | { id: string; kind: "warning_acknowledgement"; warning: string }
    | { id: "retry:parsing"; kind: "retry_parsing" }
  >;
};

export type ImportOutcome =
  | { outcome: "published"; import: CourseScorecardImportView; handle: string }
  | { outcome: "paused"; import: CourseScorecardImportView }
  | { outcome: "cancelled"; import: CourseScorecardImportView }
  | { outcome: "rejected"; reason: string };

export type StartCourseScorecardImportInput = {
  actorId: string;
  target: { kind: "new"; name: string };
  stagedScorecardImageHandle: string;
  stagedCourseImageHandle?: string;
};

export type ContinueCourseScorecardImportInput = {
  actorId: string;
  importId: string;
  expectedRevision: number;
  intent:
    | { kind: "cancel" }
    | { kind: "retry_parsing" }
    | {
        kind: "resolve";
        teeMetadata?: Record<string, { rating: number; slope: number }>;
        acknowledgeWarnings?: string[];
        corrections?: {
          tees?: Record<string, TeeCorrection>;
          holes?: Record<string, HoleCorrection>;
        };
        excludeTees?: string[];
      };
};

export type ScorecardImportDependencies = {
  parseScorecardImage: (stagedImageHandle: string) => Promise<{
    scorecard: { tees: ParsedTee[]; holes: ParsedHole[] };
    warnings: string[];
  }>;
  now?: () => Date;
};

function promptIdForTee(index: number) {
  return `tee:${index}:metadata`;
}

function teeIdFor(index: number) {
  return `tee:${index}`;
}

function holeIdFor(index: number) {
  return `hole:${index}`;
}

function warningIdFor(index: number) {
  return `warning:${index}`;
}

function readDocument(value: unknown): ImportDocument {
  const document = value as ImportDocument;
  if (document?.version !== IMPORT_DOCUMENT_VERSION) {
    throw new Error("Unsupported Course Scorecard Import document version");
  }
  return document;
}

function promptsFor(document: ImportDocument): CourseScorecardImportView["prompts"] {
  const excluded = new Set(document.excludedTeeIndexes ?? []);
  const metadata = document.tees.flatMap((tee, teeIndex) =>
    !excluded.has(teeIndex) && (tee.rating == null || tee.slope == null)
      ? [{ id: promptIdForTee(teeIndex), kind: "tee_metadata" as const, teeIndex, teeName: tee.name }]
      : [],
  );
  const teeValidation = document.tees.flatMap((tee, teeIndex) =>
    !excluded.has(teeIndex) && !validTeeForCourse(tee, document, excluded)
      ? [{ id: `${teeIdFor(teeIndex)}:validation`, kind: "tee_validation" as const, teeIndex, teeName: tee.name }]
      : [],
  );
  const holeValidation = document.holes.flatMap((hole, holeIndex) =>
    !validHole(hole, holeIndex, document.holes)
      ? [{ id: `${holeIdFor(holeIndex)}:validation`, kind: "hole_validation" as const, holeIndex }]
      : [],
  );
  const courseHoleValidation = document.holes.length === 18
    ? []
    : [{ id: "course:holes:validation" as const, kind: "course_holes_validation" as const }];
  const warnings = document.warnings
    .map((warning, index) => ({ warning, id: warningIdFor(index) }))
    .filter(({ id }) => !document.acknowledgedWarnings.includes(id))
    .map(({ warning, id }) => ({
      id,
      kind: "warning_acknowledgement" as const,
      warning,
    }));
  return [
    ...metadata,
    ...teeValidation,
    ...holeValidation,
    ...courseHoleValidation,
    ...warnings,
    ...(document.parseFailed
      ? [{ id: "retry:parsing" as const, kind: "retry_parsing" as const }]
      : []),
  ];
}

function toView(row: {
  id: string;
  status: "paused" | "published" | "cancelled";
  revision: number;
  expiresAt: Date | null;
  reservedHandle: string | null;
  document: unknown;
}): CourseScorecardImportView {
  const document = readDocument(row.document);
  return {
    id: row.id,
    status: row.status,
    revision: row.revision,
    expiresAt: row.expiresAt,
    target: { kind: "new", name: document.name, handle: row.reservedHandle! },
    parsed: {
      tees: document.tees.map((tee, index) => ({ ...tee, id: teeIdFor(index), excluded: (document.excludedTeeIndexes ?? []).includes(index) })),
      holes: document.holes.map((hole, index) => ({ ...hole, id: holeIdFor(index) })),
    },
    proposedMatches: [],
    allowedIntents: row.status === "paused" ? ["resolve", "cancel", ...(document.parseFailed ? ["retry_parsing" as const] : [])] : [],
    prompts: row.status === "paused" ? promptsFor(document) : [],
  };
}

function validTee(tee: ParsedTee) {
  return Boolean(tee.name.trim()) && tee.rating != null && tee.rating > 0 && tee.slope != null && tee.slope >= 55 && tee.slope <= 155 && tee.yardages.length === 18 && tee.yardages.every((yards) => Number.isInteger(yards) && yards >= 50 && yards <= 800);
}

function validTeeForCourse(tee: ParsedTee, document: ImportDocument, excluded: Set<number>) {
  if (!validTee(tee)) return false;
  const name = tee.name.trim().toLowerCase();
  return document.tees.filter((candidate, index) => !excluded.has(index) && candidate.name.trim().toLowerCase() === name).length === 1;
}

function isTeeCorrection(value: unknown): value is TeeCorrection {
  if (!value || typeof value !== "object") return false;
  const correction = value as Record<string, unknown>;
  return Object.entries(correction).every(([key, field]) =>
    (key === "name" || key === "color") ? typeof field === "string" :
    (key === "rating" || key === "slope") ? typeof field === "number" :
    key === "yardages" && Array.isArray(field) && field.every((yardage) => typeof yardage === "number"),
  );
}

function isHoleCorrection(value: unknown): value is HoleCorrection {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).every(([key, field]) =>
    (key === "hole" || key === "par" || key === "handicap") && typeof field === "number",
  );
}

function validHole(hole: ParsedHole, index: number, holes: ParsedHole[]) {
  return hole.hole === index + 1 && hole.par >= 2 && hole.par <= 7 && hole.handicap >= 1 && hole.handicap <= 18 && holes.filter((candidate) => candidate.handicap === hole.handicap).length === 1;
}

function validNewCourseScorecard(document: ImportDocument) {
  const excluded = new Set(document.excludedTeeIndexes ?? []);
  const tees = document.tees.filter((_, index) => !excluded.has(index));
  if (tees.length === 0 || document.holes.length !== 18) return false;
  const normalizedNames = new Set<string>();
  for (const tee of tees) {
    if (!validTee(tee)) return false;
    const normalized = tee.name.trim().toLowerCase();
    if (normalizedNames.has(normalized)) return false;
    normalizedNames.add(normalized);
  }
  for (const [index, hole] of document.holes.entries()) {
    if (!validHole(hole, index, document.holes)) return false;
  }
  return true;
}

export function createCourseScorecardImport(deps: ScorecardImportDependencies) {
  const now = deps.now ?? (() => new Date());

  async function administrator(actorId: string) {
    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, actorId), eq(users.isAdmin, true)))
      .limit(1);
    return actor != null;
  }

  async function publishNewCourse(row: {
    id: string;
    reservedHandle: string | null;
    stagedCourseImageHandle: string | null;
    stagedScorecardImageHandle: string;
    document: unknown;
  }) {
    const document = readDocument(row.document);
    if (!row.reservedHandle || promptsFor(document).length || !validNewCourseScorecard(document)) return false;
    return db.transaction(async (tx) => {
      const [lockedImport] = await tx
        .select({ status: courseScorecardImports.status })
        .from(courseScorecardImports)
        .where(eq(courseScorecardImports.id, row.id))
        .for("update");
      if (lockedImport?.status !== "paused") return false;
      const [course] = await tx
        .insert(courses)
        .values({
          handle: row.reservedHandle!,
          name: document.name,
          // Blob handles are opaque to this module. The production adapter's
          // handles are the persisted blob URLs; test adapters use opaque ids.
          imgUrl: row.stagedCourseImageHandle,
          scorecardImgUrl: row.stagedScorecardImageHandle,
        })
        .returning({ id: courses.id });
      const excluded = new Set(document.excludedTeeIndexes ?? []);
      for (const [sortOrder, tee] of document.tees.entries()) {
        if (excluded.has(sortOrder)) continue;
        const [insertedTee] = await tx
          .insert(courseTees)
          .values({
            courseId: course.id,
            name: tee.name.trim(),
            color: tee.color ?? null,
            rating: String(tee.rating),
            slope: tee.slope!,
            sortOrder,
          })
          .returning({ id: courseTees.id });
        await tx.insert(teeYardages).values(
          tee.yardages.map((yards, index) => ({ teeId: insertedTee.id, hole: index + 1, yards })),
        );
      }
      await tx.insert(courseHoles).values(
        document.holes.map((hole) => ({ courseId: course.id, hole: hole.hole, par: hole.par, handicap: hole.handicap })),
      );
      await tx
        .update(courseScorecardImports)
        .set({ status: "published", expiresAt: null, publishedAt: now(), updatedAt: now(), document: { ...document, audit: [...document.audit, { event: "published", actorId: "system", at: now().toISOString() }] } })
        .where(eq(courseScorecardImports.id, row.id));
      return true;
    });
  }

  async function expireIfInactive(row: {
    id: string;
    status: "paused" | "published" | "cancelled";
    expiresAt: Date | null;
    document: unknown;
  }) {
    if (row.status !== "paused" || !row.expiresAt || row.expiresAt > now()) return false;
    const document = readDocument(row.document);
    const expired = {
      ...document,
      audit: [...document.audit, { event: "cancelled" as const, actorId: "system", at: now().toISOString() }],
    };
    await db
      .update(courseScorecardImports)
      .set({ status: "cancelled", document: expired, expiresAt: null, updatedAt: now() })
      .where(and(eq(courseScorecardImports.id, row.id), eq(courseScorecardImports.status, "paused"), eq(courseScorecardImports.expiresAt, row.expiresAt)));
    return true;
  }

  return {
    async start(input: StartCourseScorecardImportInput): Promise<ImportOutcome> {
      if (!(await administrator(input.actorId))) return { outcome: "rejected", reason: "forbidden" };
      const name = input.target.name.trim();
      const handle = courseHandleFromName(name);
      if (!name || !handle || !input.stagedScorecardImageHandle) return { outcome: "rejected", reason: "invalid_input" };
      const [existingCourse] = await db.select({ id: courses.id }).from(courses).where(eq(courses.handle, handle)).limit(1);
      if (existingCourse) return { outcome: "rejected", reason: "target_exists" };
      const [existing] = await db.select().from(courseScorecardImports).where(and(eq(courseScorecardImports.reservedHandle, handle), eq(courseScorecardImports.stagedScorecardImageHandle, input.stagedScorecardImageHandle))).limit(1);
      if (existing && existing.status !== "cancelled") {
        if (await expireIfInactive(existing)) return this.start(input);
        const view = toView(existing);
        return existing.status === "published" ? { outcome: "published", import: view, handle } : { outcome: "paused", import: view };
      }
      const id = crypto.randomUUID();
      const expiresAt = new Date(now().getTime() + IMPORT_LIFETIME_MS);
      const initialDocument: ImportDocument = { version: IMPORT_DOCUMENT_VERSION, name, tees: [], holes: [], warnings: [], acknowledgedWarnings: [], excludedTeeIndexes: [], parseFailed: false, audit: [{ event: "started", actorId: input.actorId, at: now().toISOString() }] };
      try {
        await db.insert(courseScorecardImports).values({ id, targetKind: "new", reservedHandle: handle, stagedScorecardImageHandle: input.stagedScorecardImageHandle, stagedCourseImageHandle: input.stagedCourseImageHandle ?? null, status: "paused", revision: 0, document: initialDocument, createdByUserId: input.actorId, lastEditedByUserId: input.actorId, expiresAt });
      } catch (error) {
        if ((error as { code?: string; cause?: { code?: string } }).code === "23505" || (error as { cause?: { code?: string } }).cause?.code === "23505") return { outcome: "rejected", reason: "active_import_conflict" };
        throw error;
      }
      try {
        const parsed = await deps.parseScorecardImage(input.stagedScorecardImageHandle);
        const document: ImportDocument = { ...initialDocument, tees: parsed.scorecard.tees.map(({ name, color, rating, slope, yardages }) => ({ name, color, rating, slope, yardages })), holes: parsed.scorecard.holes, warnings: parsed.warnings };
        await db.update(courseScorecardImports).set({ document, revision: 1, updatedAt: now(), expiresAt }).where(eq(courseScorecardImports.id, id));
      } catch {
        // The persisted empty draft is intentionally inspectable and retryable.
        await db.update(courseScorecardImports).set({ document: { ...initialDocument, parseFailed: true }, revision: 1, updatedAt: now(), expiresAt }).where(eq(courseScorecardImports.id, id));
      }
      const [row] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, id)).limit(1);
      if (!row) throw new Error("Course Scorecard Import disappeared after creation");
      if (await publishNewCourse(row)) {
        const [published] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, id)).limit(1);
        return { outcome: "published", import: toView(published!), handle };
      }
      return { outcome: "paused", import: toView(row) };
    },

    async inspect({ actorId, importId }: { actorId: string; importId: string }): Promise<ImportOutcome> {
      if (!(await administrator(actorId))) return { outcome: "rejected", reason: "forbidden" };
      const [row] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, importId)).limit(1);
      if (!row || row.status !== "paused" || !row.expiresAt) return { outcome: "rejected", reason: "missing_or_expired_import" };
      if (await expireIfInactive(row)) return { outcome: "rejected", reason: "missing_or_expired_import" };
      const expiresAt = new Date(now().getTime() + IMPORT_LIFETIME_MS);
      await db.update(courseScorecardImports).set({ expiresAt, updatedAt: now() }).where(eq(courseScorecardImports.id, importId));
      return { outcome: "paused", import: toView({ ...row, expiresAt }) };
    },

    async continue(input: ContinueCourseScorecardImportInput): Promise<ImportOutcome> {
      if (!(await administrator(input.actorId))) return { outcome: "rejected", reason: "forbidden" };
      const [row] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, input.importId)).limit(1);
      if (!row || row.status !== "paused" || !row.expiresAt) return { outcome: "rejected", reason: "missing_or_expired_import" };
      if (await expireIfInactive(row)) return { outcome: "rejected", reason: "missing_or_expired_import" };
      if (row.revision !== input.expectedRevision) return { outcome: "rejected", reason: "revision_conflict" };
      const document = readDocument(row.document);
      if (input.intent.kind === "cancel") {
        const cancelled = { ...document, audit: [...document.audit, { event: "cancelled" as const, actorId: input.actorId, at: now().toISOString() }] };
        const result = await db.update(courseScorecardImports).set({ status: "cancelled", document: cancelled, revision: row.revision + 1, expiresAt: null, updatedAt: now(), lastEditedByUserId: input.actorId }).where(and(eq(courseScorecardImports.id, row.id), eq(courseScorecardImports.status, "paused"), eq(courseScorecardImports.revision, row.revision))).returning();
        if (!result[0]) return { outcome: "rejected", reason: "revision_conflict" };
        return { outcome: "cancelled", import: toView({ ...row, status: "cancelled", document: cancelled, revision: row.revision + 1, expiresAt: null }) };
      }
      if (input.intent.kind === "retry_parsing") {
        if (!document.parseFailed) return { outcome: "rejected", reason: "invalid_resolution" };
        try {
          const parsed = await deps.parseScorecardImage(row.stagedScorecardImageHandle);
          const retried: ImportDocument = {
            ...document,
            tees: parsed.scorecard.tees.map(({ name, color, rating, slope, yardages }) => ({ name, color, rating, slope, yardages })),
            holes: parsed.scorecard.holes,
            warnings: parsed.warnings,
            acknowledgedWarnings: [],
            parseFailed: false,
            audit: [...document.audit, { event: "retried", actorId: input.actorId, at: now().toISOString() }],
          };
          const result = await db.update(courseScorecardImports).set({ document: retried, revision: row.revision + 1, expiresAt: new Date(now().getTime() + IMPORT_LIFETIME_MS), updatedAt: now(), lastEditedByUserId: input.actorId }).where(and(eq(courseScorecardImports.id, row.id), eq(courseScorecardImports.status, "paused"), eq(courseScorecardImports.revision, row.revision))).returning();
          if (!result[0]) return { outcome: "rejected", reason: "revision_conflict" };
          if (await publishNewCourse(result[0])) {
            const [published] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, row.id)).limit(1);
            return { outcome: "published", import: toView(published!), handle: row.reservedHandle! };
          }
          return { outcome: "paused", import: toView(result[0]) };
        } catch {
          const failedRetry: ImportDocument = {
            ...document,
            audit: [...document.audit, { event: "retry_failed", actorId: input.actorId, at: now().toISOString() }],
          };
          const result = await db.update(courseScorecardImports).set({ document: failedRetry, revision: row.revision + 1, expiresAt: new Date(now().getTime() + IMPORT_LIFETIME_MS), updatedAt: now(), lastEditedByUserId: input.actorId }).where(and(eq(courseScorecardImports.id, row.id), eq(courseScorecardImports.status, "paused"), eq(courseScorecardImports.revision, row.revision))).returning();
          if (!result[0]) return { outcome: "rejected", reason: "revision_conflict" };
          return { outcome: "paused", import: toView(result[0]) };
        }
      }
      const resolution = input.intent;
      const teeCorrections = resolution.corrections?.tees ?? {};
      const holeCorrections = resolution.corrections?.holes ?? {};
      const allowedTeeIds = new Set(document.tees.map((_, index) => teeIdFor(index)));
      const allowedHoleIds = new Set(document.holes.map((_, index) => holeIdFor(index)));
      if (
        Object.entries(teeCorrections).some(([id, correction]) => !allowedTeeIds.has(id) || !isTeeCorrection(correction)) ||
        Object.entries(holeCorrections).some(([id, correction]) => !allowedHoleIds.has(id) || !isHoleCorrection(correction)) ||
        (resolution.excludeTees ?? []).some((id) => !allowedTeeIds.has(id)) ||
        Object.keys(resolution.teeMetadata ?? {}).some((id) => !document.tees.some((tee, index) => promptIdForTee(index) === id && (tee.rating == null || tee.slope == null))) ||
        (resolution.acknowledgeWarnings ?? []).some((id) => !document.warnings.some((_, index) => warningIdFor(index) === id))
      ) return { outcome: "rejected", reason: "invalid_resolution" };
      const tees = document.tees.map((tee, index) => {
        const value = resolution.teeMetadata?.[promptIdForTee(index)];
        return { ...tee, ...teeCorrections[teeIdFor(index)], ...(value ? { rating: value.rating, slope: value.slope } : {}) };
      });
      const holes = document.holes.map((hole, index) => ({ ...hole, ...holeCorrections[holeIdFor(index)] }));
      const hasCorrection = Object.keys(teeCorrections).length > 0 || Object.keys(holeCorrections).length > 0 || (resolution.excludeTees?.length ?? 0) > 0;
      const excludedTeeIndexes = [...new Set([...(document.excludedTeeIndexes ?? []), ...(resolution.excludeTees ?? []).map((id) => Number(id.slice("tee:".length)))])];
      const updated: ImportDocument = {
        ...document,
        tees,
        holes,
        excludedTeeIndexes,
        // A correction can change what a parser warning refers to. Requiring
        // acknowledgement again is conservative and prevents stale approval.
        acknowledgedWarnings: hasCorrection ? [] : [...new Set([...(document.acknowledgedWarnings ?? []), ...(resolution.acknowledgeWarnings ?? [])])],
        audit: [...document.audit, { event: "resolved", actorId: input.actorId, at: now().toISOString() }],
      };
      const expiresAt = new Date(now().getTime() + IMPORT_LIFETIME_MS);
      const result = await db.update(courseScorecardImports).set({ document: updated, revision: row.revision + 1, expiresAt, updatedAt: now(), lastEditedByUserId: input.actorId }).where(and(eq(courseScorecardImports.id, row.id), eq(courseScorecardImports.status, "paused"), eq(courseScorecardImports.revision, row.revision))).returning();
      if (!result[0]) return { outcome: "rejected", reason: "revision_conflict" };
      const updatedRow = result[0];
      if (await publishNewCourse(updatedRow)) {
        const [published] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, row.id)).limit(1);
        return { outcome: "published", import: toView(published!), handle: row.reservedHandle! };
      }
      return { outcome: "paused", import: toView(updatedRow) };
    },
  };
}
