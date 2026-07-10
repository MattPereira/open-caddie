import { and, asc, eq, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  courseHoles,
  courseScorecardImports,
  courseTees,
  courses,
  teeYardages,
  users,
} from "@/db/schema";
import type { Scorecard, ScorecardWarning } from "@/lib/ai/course-scorecard-parser";
import { courseHandleFromName } from "@/lib/course-handle";

const IMPORT_DOCUMENT_VERSION = 1;
const IMPORT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export const TEE_RATING_MIN = 0;
export const TEE_SLOPE_MIN = 55;
export const TEE_SLOPE_MAX = 155;

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
  courseId?: number;
  handle?: string;
  existingTees?: Array<{ id: number; name: string; color: string | null; rating: string; slope: number; sortOrder: number }>;
  existingCourseFingerprint?: string;
  parserModel?: string;
  tees: ParsedTee[];
  holes: ParsedHole[];
  warnings: ScorecardWarning[];
  acknowledgedWarnings: string[];
  excludedTeeIndexes: number[];
  teeResolutions: Record<string, { kind: "new" } | { kind: "existing"; teeId: number }>;
  placeholderResolutions: Record<string, { kind: "keep" } | { kind: "map"; teeId: string }>;
  parseFailed: boolean;
  audit: Array<{ event: "started" | "resolved" | "retried" | "retry_failed" | "replaced_image" | "published" | "cancelled" | "stale"; actorId: string; at: string; decision?: ContinueCourseScorecardImportInput["intent"] }>;
};

export type CourseScorecardImportView = {
  id: string;
  status: "paused" | "published" | "stale" | "cancelled";
  revision: number;
  expiresAt: Date | null;
  target: { kind: "new"; name: string; handle: string } | { kind: "existing"; id: number; name: string; handle: string };
  parsed: {
    tees: Array<ParsedTee & { id: string; excluded: boolean }>;
    holes: Array<ParsedHole & { id: string }>;
  };
  proposedMatches: Array<{ teeId: string; parsedName: string; kind: "new" | "exact" | "ambiguous"; existingTeeIds: number[] }>;
  allowedIntents: Array<"resolve" | "cancel" | "retry_parsing" | "replace_scorecard_image">;
  prompts: Array<
    | { id: string; kind: "tee_metadata"; teeIndex: number; teeName: string }
    | { id: string; kind: "tee_validation"; teeIndex: number; teeName: string }
    | { id: string; kind: "tee_match"; teeIndex: number; teeName: string; existingTeeIds: number[] }
    | { id: string; kind: "placeholder_tee"; teeId: number; teeName: string }
    | { id: string; kind: "hole_validation"; holeIndex: number }
    | { id: "course:holes:validation"; kind: "course_holes_validation" }
    | { id: string; kind: "warning_acknowledgement"; warning: string }
    | { id: "retry:parsing"; kind: "retry_parsing" }
    | { id: "replace:scorecard-image"; kind: "replace_scorecard_image" }
  >;
  audit?: {
    creatorId?: string;
    lastEditorId?: string;
    parserModel?: string;
    warnings: string[];
    decisions: Array<{ actorId: string; at: string; decision: ContinueCourseScorecardImportInput["intent"] }>;
    events: ImportDocument["audit"];
  };
};

export type ImportOutcome =
  | { outcome: "published"; import: CourseScorecardImportView; handle: string }
  | { outcome: "paused"; import: CourseScorecardImportView }
  | { outcome: "stale"; import: CourseScorecardImportView }
  | { outcome: "cancelled"; import: CourseScorecardImportView }
  | { outcome: "rejected"; reason: string; import?: CourseScorecardImportView };

export type StartCourseScorecardImportInput = {
  actorId: string;
  target: { kind: "new"; name: string } | { kind: "existing"; courseId: number };
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
    | { kind: "replace_scorecard_image"; stagedScorecardImageHandle: string }
    | {
        kind: "resolve";
        teeMetadata?: Record<string, { rating: number; slope: number }>;
        acknowledgeWarnings?: string[];
        corrections?: {
          tees?: Record<string, TeeCorrection>;
          holes?: Record<string, HoleCorrection>;
        };
        excludeTees?: string[];
        teeResolutions?: Record<string, { kind: "new" } | { kind: "existing"; teeId: number }>;
        placeholderResolutions?: Record<string, { kind: "keep" } | { kind: "map"; teeId: string }>;
      };
};

export type ScorecardImportDependencies = {
  parseScorecardImage: (stagedImageHandle: string) => Promise<{
    scorecard: { tees: ParsedTee[]; holes: ParsedHole[] };
    warnings: ScorecardWarning[];
    parserModel?: string;
  }>;
  now?: () => Date;
  deleteStagedImage?: (handle: string) => Promise<boolean>;
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

function normalizedTeeName(value: string) {
  return value.trim().toLowerCase();
}

function isPlaceholderTee(value: string) {
  return ["unknown", "unkown"].includes(normalizedTeeName(value));
}

function exactMatches(document: ImportDocument, tee: ParsedTee) {
  return (document.existingTees ?? []).filter((existing) => normalizedTeeName(existing.name) === normalizedTeeName(tee.name));
}

function defaultTeeResolutions(document: ImportDocument, tees: ParsedTee[]): ImportDocument["teeResolutions"] {
  const resolutions: ImportDocument["teeResolutions"] = {};
  if (!document.existingTees) return resolutions;
  for (const [index, tee] of tees.entries()) {
    const matches = exactMatches(document, tee);
    if (matches.length === 1) resolutions[teeIdFor(index)] = { kind: "existing", teeId: matches[0].id };
    else if (matches.length === 0) resolutions[teeIdFor(index)] = { kind: "new" };
  }
  return resolutions;
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
  const metadata = document.tees.flatMap((tee, teeIndex) => {
    const resolution = document.teeResolutions?.[teeIdFor(teeIndex)];
    const mappedPlaceholder = Object.entries(document.placeholderResolutions ?? {}).find(([, value]) => value.kind === "map" && value.teeId === teeIdFor(teeIndex));
    const matched = resolution?.kind === "existing"
      ? (document.existingTees ?? []).find((existing) => existing.id === resolution.teeId)
      : mappedPlaceholder ? (document.existingTees ?? []).find((existing) => existing.id === Number(mappedPlaceholder[0])) : undefined;
    return !excluded.has(teeIndex) && ((tee.rating == null && !matched) || (tee.slope == null && !matched))
      ? [{ id: promptIdForTee(teeIndex), kind: "tee_metadata" as const, teeIndex, teeName: tee.name }]
      : [];
  });
  const teeMatches = document.existingTees ? document.tees.flatMap((tee, teeIndex) => {
    const mappedPlaceholder = Object.values(document.placeholderResolutions ?? {}).some((resolution) => resolution.kind === "map" && resolution.teeId === teeIdFor(teeIndex));
    if (excluded.has(teeIndex) || mappedPlaceholder || document.teeResolutions?.[teeIdFor(teeIndex)]) return [];
    const matches = exactMatches(document, tee);
    return matches.length === 1 ? [] : [{ id: `${teeIdFor(teeIndex)}:match`, kind: "tee_match" as const, teeIndex, teeName: tee.name, existingTeeIds: matches.map((match) => match.id) }];
  }) : [];
  const teeValidation = document.tees.flatMap((tee, teeIndex) =>
    !excluded.has(teeIndex) && !validTeeForCourse(tee, document, excluded, teeIndex)
      ? [{ id: `${teeIdFor(teeIndex)}:validation`, kind: "tee_validation" as const, teeIndex, teeName: tee.name }]
      : [],
  );
  const holeValidation = document.existingTees ? [] : document.holes.flatMap((hole, holeIndex) =>
    !validHole(hole, holeIndex, document.holes)
      ? [{ id: `${holeIdFor(holeIndex)}:validation`, kind: "hole_validation" as const, holeIndex }]
      : [],
  );
  const courseHoleValidation = document.existingTees ? [] : document.holes.length === 18
    ? []
    : [{ id: "course:holes:validation" as const, kind: "course_holes_validation" as const }];
  const warnings = document.warnings
    .map((warning, index) => ({ warning, id: warningIdFor(index) }))
    .filter(({ warning }) => !document.existingTees || warning.scope === "tee")
    .filter(({ id }) => !document.acknowledgedWarnings.includes(id))
    .map(({ warning, id }) => ({
      id,
      kind: "warning_acknowledgement" as const,
      warning: warning.message,
    }));
  const placeholders = (document.existingTees ?? []).flatMap((tee) =>
    isPlaceholderTee(tee.name) && !document.placeholderResolutions?.[String(tee.id)]
      ? [{ id: `placeholder:${tee.id}`, kind: "placeholder_tee" as const, teeId: tee.id, teeName: tee.name }]
      : [],
  );
  return [
    ...metadata,
    ...teeMatches,
    ...teeValidation,
    ...holeValidation,
    ...courseHoleValidation,
    ...warnings,
    ...placeholders,
    ...(document.parseFailed
      ? [
          { id: "retry:parsing" as const, kind: "retry_parsing" as const },
          { id: "replace:scorecard-image" as const, kind: "replace_scorecard_image" as const },
        ]
      : []),
  ];
}

function toView(row: {
  id: string;
  status: "paused" | "published" | "stale" | "cancelled";
  revision: number;
  expiresAt: Date | null;
  reservedHandle: string | null;
  createdByUserId?: string;
  lastEditedByUserId?: string;
  document: unknown;
}): CourseScorecardImportView {
  const document = readDocument(row.document);
  const audit = row.status === "paused" ? undefined : {
    creatorId: row.createdByUserId,
    lastEditorId: row.lastEditedByUserId,
    parserModel: document.parserModel,
    warnings: document.warnings.map((warning) => warning.message),
    decisions: document.audit.flatMap((event) => event.decision ? [{ actorId: event.actorId, at: event.at, decision: event.decision }] : []),
    events: document.audit,
  };
  return {
    id: row.id,
    status: row.status,
    revision: row.revision,
    expiresAt: row.expiresAt,
    target: row.reservedHandle
      ? { kind: "new", name: document.name, handle: row.reservedHandle }
      : { kind: "existing", id: document.courseId!, name: document.name, handle: document.handle! },
    parsed: {
      tees: document.tees.map((tee, index) => ({ ...tee, id: teeIdFor(index), excluded: (document.excludedTeeIndexes ?? []).includes(index) })),
      holes: document.holes.map((hole, index) => ({ ...hole, id: holeIdFor(index) })),
    },
    proposedMatches: document.tees.map((tee, index) => {
      const matches = exactMatches(document, tee);
      return { teeId: teeIdFor(index), parsedName: tee.name, kind: matches.length === 1 ? "exact" : matches.length === 0 ? "new" : "ambiguous", existingTeeIds: matches.map((match) => match.id) };
    }),
    allowedIntents: row.status !== "paused"
      ? []
      : document.parseFailed
        ? ["cancel", "retry_parsing", "replace_scorecard_image"]
        : ["resolve", "cancel"],
    prompts: row.status === "paused" ? promptsFor(document) : [],
    ...(audit ? { audit } : {}),
  };
}

function validTee(tee: ParsedTee) {
  return Boolean(tee.name.trim()) && tee.rating != null && tee.rating > TEE_RATING_MIN && tee.slope != null && tee.slope >= TEE_SLOPE_MIN && tee.slope <= TEE_SLOPE_MAX && tee.yardages.length === 18 && tee.yardages.every((yards) => Number.isInteger(yards) && yards >= 50 && yards <= 800);
}

function validTeeForCourse(tee: ParsedTee, document: ImportDocument, excluded: Set<number>, teeIndex?: number) {
  const resolution = teeIndex == null ? undefined : document.teeResolutions?.[teeIdFor(teeIndex)];
  const mappedPlaceholder = teeIndex == null ? undefined : Object.entries(document.placeholderResolutions ?? {}).find(([, value]) => value.kind === "map" && value.teeId === teeIdFor(teeIndex));
  const fallback = resolution?.kind === "existing"
    ? (document.existingTees ?? []).find((existing) => existing.id === resolution.teeId)
    : mappedPlaceholder ? (document.existingTees ?? []).find((existing) => existing.id === Number(mappedPlaceholder[0])) : undefined;
  if (!validTee({ ...tee, rating: tee.rating ?? (fallback ? Number(fallback.rating) : undefined), slope: tee.slope ?? fallback?.slope })) return false;
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

type CourseSnapshotReader = Pick<typeof db, "select">;

async function existingCourseSnapshot(database: CourseSnapshotReader, courseId: number, lock = false) {
  const courseQuery = database
    .select({ id: courses.id, handle: courses.handle, name: courses.name, imgUrl: courses.imgUrl, scorecardImgUrl: courses.scorecardImgUrl })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const [course] = lock ? await courseQuery.for("update") : await courseQuery;
  if (!course) return undefined;
  const teesQuery = database
    .select({ id: courseTees.id, name: courseTees.name, color: courseTees.color, rating: courseTees.rating, slope: courseTees.slope, sortOrder: courseTees.sortOrder })
    .from(courseTees)
    .where(eq(courseTees.courseId, courseId))
    .orderBy(asc(courseTees.sortOrder), asc(courseTees.id));
  const tees = lock ? await teesQuery.for("update") : await teesQuery;
  const yardsQuery = tees.length ? database.select({ teeId: teeYardages.teeId, hole: teeYardages.hole, yards: teeYardages.yards }).from(teeYardages).where(inArray(teeYardages.teeId, tees.map((tee) => tee.id))).orderBy(asc(teeYardages.teeId), asc(teeYardages.hole)) : undefined;
  const yards = yardsQuery ? (lock ? await yardsQuery.for("update") : await yardsQuery) : [];
  const holesQuery = database.select({ hole: courseHoles.hole, par: courseHoles.par, handicap: courseHoles.handicap }).from(courseHoles).where(eq(courseHoles.courseId, courseId)).orderBy(asc(courseHoles.hole));
  const holes = lock ? await holesQuery.for("update") : await holesQuery;
  return {
    fingerprint: JSON.stringify({ course, tees, yards, holes }),
    tees,
  };
}

export function createCourseScorecardImport(deps: ScorecardImportDependencies) {
  const now = deps.now ?? (() => new Date());
  const deleteStagedImage = deps.deleteStagedImage ?? (async () => true);

  async function administrator(actorId: string) {
    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, actorId), eq(users.isAdmin, true)))
      .limit(1);
    return actor != null;
  }

  function cancellationUpdate(document: ImportDocument, actorId: string, handles: Array<string | null>, pendingHandles: string[]) {
    return {
      document: {
        ...document,
        tees: [],
        holes: [],
        warnings: [],
        acknowledgedWarnings: [],
        excludedTeeIndexes: [],
        existingTees: undefined,
        existingCourseFingerprint: undefined,
        teeResolutions: {},
        placeholderResolutions: {},
        parseFailed: false,
        audit: [...document.audit, { event: "cancelled" as const, actorId, at: now().toISOString() }],
      } satisfies ImportDocument,
      stagedImageDeletionHandles: [...pendingHandles, ...handles.filter((handle): handle is string => Boolean(handle))],
      stagedScorecardImageHandle: "",
      stagedCourseImageHandle: null,
    };
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

  async function publishExistingCourse(row: {
    id: string;
    courseId: number | null;
    stagedScorecardImageHandle: string;
    document: unknown;
  }) {
    const document = readDocument(row.document);
    if (!row.courseId || !document.existingTees || promptsFor(document).length) return false;
    const courseId = row.courseId;
    const existingTees = document.existingTees;
    const excluded = new Set(document.excludedTeeIndexes ?? []);
    const mappedSources = new Map(
      Object.values(document.placeholderResolutions ?? {})
        .filter((resolution): resolution is { kind: "map"; teeId: string } => resolution.kind === "map")
        .map((resolution) => [resolution.teeId, true]),
    );
    return db.transaction(async (tx) => {
      const [lockedImport] = await tx.select({ status: courseScorecardImports.status }).from(courseScorecardImports).where(eq(courseScorecardImports.id, row.id)).for("update");
      if (lockedImport?.status !== "paused") return false;
      const [lockedCourse] = await tx.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).for("update");
      if (!lockedCourse) return false;
      const current = await existingCourseSnapshot(tx, courseId, true);
      if (!current || current.fingerprint !== document.existingCourseFingerprint) {
        await tx.update(courseScorecardImports).set({
          status: "stale",
          expiresAt: null,
          updatedAt: now(),
          document: { ...document, audit: [...document.audit, { event: "stale", actorId: "system", at: now().toISOString() }] },
        }).where(eq(courseScorecardImports.id, row.id));
        return false;
      }
      const protectedTeeIds = [...new Set([
        ...Object.values(document.teeResolutions).flatMap((resolution) => resolution.kind === "existing" ? [resolution.teeId] : []),
        ...Object.keys(document.placeholderResolutions ?? {}).map(Number),
      ])];
      if (protectedTeeIds.length) {
        const lockedTees = await tx.select({ id: courseTees.id }).from(courseTees).where(and(eq(courseTees.courseId, courseId), inArray(courseTees.id, protectedTeeIds))).for("update");
        if (lockedTees.length !== protectedTeeIds.length) return false;
      }
      const updateTee = async (teeId: number, tee: ParsedTee, fallback?: { rating: string; slope: number }, sortOrder?: number) => {
        const rating = tee.rating ?? (fallback ? Number(fallback.rating) : undefined);
        const slope = tee.slope ?? fallback?.slope;
        if (rating == null || slope == null) throw new Error("Tee metadata was not resolved");
        await tx.update(courseTees).set({ name: tee.name.trim(), color: tee.color ?? null, rating: String(rating), slope, sortOrder: sortOrder ?? 0 }).where(eq(courseTees.id, teeId));
        await tx.delete(teeYardages).where(eq(teeYardages.teeId, teeId));
        await tx.insert(teeYardages).values(tee.yardages.map((yards, index) => ({ teeId, hole: index + 1, yards })));
      };
      for (const [index, tee] of document.tees.entries()) {
        const sourceId = teeIdFor(index);
        if (excluded.has(index) || mappedSources.has(sourceId)) continue;
        const resolution = document.teeResolutions[sourceId]!;
        if (resolution.kind === "existing") {
          const existing = existingTees.find((candidate) => candidate.id === resolution.teeId)!;
          await updateTee(existing.id, tee, existing, index);
        } else {
          const rating = tee.rating;
          const slope = tee.slope;
          if (rating == null || slope == null) throw new Error("Tee metadata was not resolved");
          const [inserted] = await tx.insert(courseTees).values({ courseId: row.courseId!, name: tee.name.trim(), color: tee.color ?? null, rating: String(rating), slope, sortOrder: index }).returning({ id: courseTees.id });
          await tx.insert(teeYardages).values(tee.yardages.map((yards, hole) => ({ teeId: inserted.id, hole: hole + 1, yards })));
        }
      }
      for (const [placeholderId, resolution] of Object.entries(document.placeholderResolutions ?? {})) {
        if (resolution.kind !== "map") continue;
        const sourceIndex = Number(resolution.teeId.slice("tee:".length));
        const source = document.tees[sourceIndex]!;
        const placeholder = existingTees.find((tee) => tee.id === Number(placeholderId))!;
        await updateTee(placeholder.id, source, placeholder, sourceIndex);
      }
      await tx.update(courses).set({ scorecardImgUrl: row.stagedScorecardImageHandle }).where(eq(courses.id, courseId));
      await tx.update(courseScorecardImports).set({ status: "published", expiresAt: null, publishedAt: now(), updatedAt: now(), document: { ...document, audit: [...document.audit, { event: "published", actorId: "system", at: now().toISOString() }] } }).where(eq(courseScorecardImports.id, row.id));
      return true;
    });
  }

  function publishCourse(row: Parameters<typeof publishNewCourse>[0] & { targetKind: "new" | "existing"; courseId: number | null }) {
    return row.targetKind === "new" ? publishNewCourse(row) : publishExistingCourse(row);
  }

  async function expireIfInactive(row: {
    id: string;
    status: "paused" | "published" | "stale" | "cancelled";
    expiresAt: Date | null;
    stagedScorecardImageHandle: string;
    stagedCourseImageHandle: string | null;
    stagedImageDeletionHandles: string[];
    document: unknown;
  }) {
    if (row.status !== "paused" || !row.expiresAt || row.expiresAt > now()) return false;
    const document = readDocument(row.document);
    const cancellation = cancellationUpdate(document, "system", [row.stagedScorecardImageHandle, row.stagedCourseImageHandle], row.stagedImageDeletionHandles ?? []);
    await db
      .update(courseScorecardImports)
      .set({ status: "cancelled", ...cancellation, expiresAt: null, updatedAt: now() })
      .where(and(eq(courseScorecardImports.id, row.id), eq(courseScorecardImports.status, "paused"), eq(courseScorecardImports.expiresAt, row.expiresAt)));
    return true;
  }

  async function cleanupExpiredAndStagedImages() {
    const expired = await db.select().from(courseScorecardImports).where(and(eq(courseScorecardImports.status, "paused"), lte(courseScorecardImports.expiresAt, now())));
    for (const row of expired) await expireIfInactive(row);

    const imports = await db.select().from(courseScorecardImports);
    for (const row of imports) {
      const pending = row.stagedImageDeletionHandles ?? [];
      if (!pending.length) continue;
      const remaining: string[] = [];
      for (const handle of pending) {
        try {
          if (!(await deleteStagedImage(handle))) remaining.push(handle);
        } catch {
          remaining.push(handle);
        }
      }
      await db.update(courseScorecardImports).set({ stagedImageDeletionHandles: remaining, updatedAt: now() }).where(eq(courseScorecardImports.id, row.id));
    }
  }

  async function currentOutcome(importId: string): Promise<ImportOutcome> {
    const [current] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, importId)).limit(1);
    if (!current) return { outcome: "rejected", reason: "missing_or_expired_import" };
    const view = toView(current);
    if (current.status === "published") return { outcome: "published", import: view, handle: current.reservedHandle ?? readDocument(current.document).handle! };
    if (current.status === "stale") return { outcome: "stale", import: view };
    if (current.status === "cancelled") return { outcome: "cancelled", import: view };
    return { outcome: "paused", import: view };
  }

  async function revisionConflict(importId: string): Promise<ImportOutcome> {
    const [current] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, importId)).limit(1);
    return { outcome: "rejected", reason: "revision_conflict", ...(current ? { import: toView(current) } : {}) };
  }

  return {
    async start(input: StartCourseScorecardImportInput): Promise<ImportOutcome> {
      if (!(await administrator(input.actorId))) return { outcome: "rejected", reason: "forbidden" };
      await cleanupExpiredAndStagedImages();
      if (!input.stagedScorecardImageHandle) return { outcome: "rejected", reason: "invalid_input" };
      const targetCourse = input.target.kind === "existing"
        ? (await db.select({ id: courses.id, name: courses.name, handle: courses.handle }).from(courses).where(eq(courses.id, input.target.courseId)).limit(1))[0]
        : undefined;
      const name = input.target.kind === "new" ? input.target.name.trim() : targetCourse?.name ?? "";
      const handle = input.target.kind === "new" ? courseHandleFromName(name) : targetCourse?.handle ?? "";
      if (!name || !handle) return { outcome: "rejected", reason: input.target.kind === "existing" ? "target_missing" : "invalid_input" };
      if (input.target.kind === "new") {
        const [existingCourse] = await db.select({ id: courses.id }).from(courses).where(eq(courses.handle, handle)).limit(1);
        if (existingCourse) return { outcome: "rejected", reason: "target_exists" };
      }
      const [existing] = await db.select().from(courseScorecardImports).where(and(input.target.kind === "new" ? eq(courseScorecardImports.reservedHandle, handle) : eq(courseScorecardImports.courseId, targetCourse!.id), eq(courseScorecardImports.stagedScorecardImageHandle, input.stagedScorecardImageHandle))).limit(1);
      if (existing && existing.status !== "cancelled") {
        if (await expireIfInactive(existing)) return this.start(input);
        return currentOutcome(existing.id);
      }
      const id = crypto.randomUUID();
      const expiresAt = new Date(now().getTime() + IMPORT_LIFETIME_MS);
      const existingSnapshot = targetCourse ? await existingCourseSnapshot(db, targetCourse.id) : undefined;
      if (targetCourse && !existingSnapshot) return { outcome: "rejected", reason: "target_missing" };
      const initialDocument: ImportDocument = { version: IMPORT_DOCUMENT_VERSION, name, ...(targetCourse ? { courseId: targetCourse.id, handle: targetCourse.handle, existingTees: existingSnapshot!.tees, existingCourseFingerprint: existingSnapshot!.fingerprint } : {}), tees: [], holes: [], warnings: [], acknowledgedWarnings: [], excludedTeeIndexes: [], teeResolutions: {}, placeholderResolutions: {}, parseFailed: false, audit: [{ event: "started", actorId: input.actorId, at: now().toISOString() }] };
      try {
        await db.insert(courseScorecardImports).values({ id, targetKind: input.target.kind, reservedHandle: input.target.kind === "new" ? handle : null, courseId: targetCourse?.id ?? null, stagedScorecardImageHandle: input.stagedScorecardImageHandle, stagedCourseImageHandle: input.stagedCourseImageHandle ?? null, status: "paused", revision: 0, document: initialDocument, createdByUserId: input.actorId, lastEditedByUserId: input.actorId, expiresAt });
      } catch (error) {
        if ((error as { code?: string; cause?: { code?: string } }).code === "23505" || (error as { cause?: { code?: string } }).cause?.code === "23505") {
          const [identical] = await db.select().from(courseScorecardImports).where(and(input.target.kind === "new" ? eq(courseScorecardImports.reservedHandle, handle) : eq(courseScorecardImports.courseId, targetCourse!.id), eq(courseScorecardImports.stagedScorecardImageHandle, input.stagedScorecardImageHandle))).limit(1);
          if (identical && identical.status !== "cancelled") return currentOutcome(identical.id);
          return { outcome: "rejected", reason: "active_import_conflict" };
        }
        throw error;
      }
      try {
        const parsed = await deps.parseScorecardImage(input.stagedScorecardImageHandle);
        const tees = parsed.scorecard.tees.map(({ name, color, rating, slope, yardages }) => ({ name, color, rating, slope, yardages }));
        const teeResolutions = defaultTeeResolutions(initialDocument, tees);
        const document: ImportDocument = { ...initialDocument, tees, holes: parsed.scorecard.holes, warnings: parsed.warnings, parserModel: parsed.parserModel, teeResolutions };
        await db.update(courseScorecardImports).set({ document, revision: 1, updatedAt: now(), expiresAt }).where(eq(courseScorecardImports.id, id));
      } catch {
        // The persisted empty draft is intentionally inspectable and retryable.
        await db.update(courseScorecardImports).set({ document: { ...initialDocument, parseFailed: true }, revision: 1, updatedAt: now(), expiresAt }).where(eq(courseScorecardImports.id, id));
      }
      const [row] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, id)).limit(1);
      if (!row) throw new Error("Course Scorecard Import disappeared after creation");
      if (await publishCourse(row)) {
        const [published] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, id)).limit(1);
        return { outcome: "published", import: toView(published!), handle };
      }
      return currentOutcome(id);
    },

    async inspect({ actorId, importId }: { actorId: string; importId: string }): Promise<ImportOutcome> {
      if (!(await administrator(actorId))) return { outcome: "rejected", reason: "forbidden" };
      await cleanupExpiredAndStagedImages();
      const [row] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, importId)).limit(1);
      if (!row) return { outcome: "rejected", reason: "missing_or_expired_import" };
      if (row.status === "published" || row.status === "stale" || row.status === "cancelled") return currentOutcome(importId);
      if (!row.expiresAt) return { outcome: "rejected", reason: "missing_or_expired_import" };
      if (await expireIfInactive(row)) return { outcome: "rejected", reason: "missing_or_expired_import" };
      const expiresAt = new Date(now().getTime() + IMPORT_LIFETIME_MS);
      await db.update(courseScorecardImports).set({ expiresAt, updatedAt: now() }).where(eq(courseScorecardImports.id, importId));
      return { outcome: "paused", import: toView({ ...row, expiresAt }) };
    },

    async continue(input: ContinueCourseScorecardImportInput): Promise<ImportOutcome> {
      if (!(await administrator(input.actorId))) return { outcome: "rejected", reason: "forbidden" };
      await cleanupExpiredAndStagedImages();
      const [row] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, input.importId)).limit(1);
      if (!row) return { outcome: "rejected", reason: "missing_or_expired_import" };
      if (row.status === "stale") return { outcome: "stale", import: toView(row) };
      if (row.status !== "paused" || !row.expiresAt) return { outcome: "rejected", reason: "revision_conflict", import: toView(row) };
      if (await expireIfInactive(row)) return { outcome: "rejected", reason: "missing_or_expired_import" };
      if (row.revision !== input.expectedRevision) return { outcome: "rejected", reason: "revision_conflict", import: toView(row) };
      const document = readDocument(row.document);
      if (input.intent.kind === "cancel") {
        const cancellation = cancellationUpdate(document, input.actorId, [row.stagedScorecardImageHandle, row.stagedCourseImageHandle], row.stagedImageDeletionHandles ?? []);
        const result = await db.update(courseScorecardImports).set({ status: "cancelled", ...cancellation, revision: row.revision + 1, expiresAt: null, updatedAt: now(), lastEditedByUserId: input.actorId }).where(and(eq(courseScorecardImports.id, row.id), eq(courseScorecardImports.status, "paused"), eq(courseScorecardImports.revision, row.revision))).returning();
        if (!result[0]) return revisionConflict(row.id);
        await cleanupExpiredAndStagedImages();
        return { outcome: "cancelled", import: toView({ ...row, status: "cancelled", document: cancellation.document, revision: row.revision + 1, expiresAt: null }) };
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
            parserModel: parsed.parserModel,
            teeResolutions: defaultTeeResolutions(document, parsed.scorecard.tees),
            placeholderResolutions: {},
            acknowledgedWarnings: [],
            parseFailed: false,
            audit: [...document.audit, { event: "retried", actorId: input.actorId, at: now().toISOString() }],
          };
          const result = await db.update(courseScorecardImports).set({ document: retried, revision: row.revision + 1, expiresAt: new Date(now().getTime() + IMPORT_LIFETIME_MS), updatedAt: now(), lastEditedByUserId: input.actorId }).where(and(eq(courseScorecardImports.id, row.id), eq(courseScorecardImports.status, "paused"), eq(courseScorecardImports.revision, row.revision))).returning();
          if (!result[0]) return revisionConflict(row.id);
          if (await publishCourse(result[0])) {
            const [published] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, row.id)).limit(1);
            return { outcome: "published", import: toView(published!), handle: row.reservedHandle ?? readDocument(row.document).handle! };
          }
          return currentOutcome(row.id);
        } catch {
          const failedRetry: ImportDocument = {
            ...document,
            audit: [...document.audit, { event: "retry_failed", actorId: input.actorId, at: now().toISOString() }],
          };
          const result = await db.update(courseScorecardImports).set({ document: failedRetry, revision: row.revision + 1, expiresAt: new Date(now().getTime() + IMPORT_LIFETIME_MS), updatedAt: now(), lastEditedByUserId: input.actorId }).where(and(eq(courseScorecardImports.id, row.id), eq(courseScorecardImports.status, "paused"), eq(courseScorecardImports.revision, row.revision))).returning();
          if (!result[0]) return revisionConflict(row.id);
          return currentOutcome(row.id);
        }
      }
      if (input.intent.kind === "replace_scorecard_image") {
        if (!document.parseFailed || !input.intent.stagedScorecardImageHandle) return { outcome: "rejected", reason: "invalid_resolution" };
        try {
          const parsed = await deps.parseScorecardImage(input.intent.stagedScorecardImageHandle);
          const replaced: ImportDocument = {
            ...document,
            tees: parsed.scorecard.tees.map(({ name, color, rating, slope, yardages }) => ({ name, color, rating, slope, yardages })),
            holes: parsed.scorecard.holes,
            warnings: parsed.warnings,
            parserModel: parsed.parserModel,
            teeResolutions: defaultTeeResolutions(document, parsed.scorecard.tees),
            placeholderResolutions: {},
            acknowledgedWarnings: [],
            excludedTeeIndexes: [],
            parseFailed: false,
            audit: [...document.audit, { event: "replaced_image", actorId: input.actorId, at: now().toISOString() }],
          };
          const result = await db.update(courseScorecardImports).set({ stagedScorecardImageHandle: input.intent.stagedScorecardImageHandle, stagedImageDeletionHandles: [...(row.stagedImageDeletionHandles ?? []), row.stagedScorecardImageHandle], document: replaced, revision: row.revision + 1, expiresAt: new Date(now().getTime() + IMPORT_LIFETIME_MS), updatedAt: now(), lastEditedByUserId: input.actorId }).where(and(eq(courseScorecardImports.id, row.id), eq(courseScorecardImports.status, "paused"), eq(courseScorecardImports.revision, row.revision))).returning();
          if (!result[0]) return revisionConflict(row.id);
          if (await publishCourse(result[0])) {
            const [published] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, row.id)).limit(1);
            return { outcome: "published", import: toView(published!), handle: row.reservedHandle ?? readDocument(row.document).handle! };
          }
          return currentOutcome(row.id);
        } catch {
          const failedReplacement: ImportDocument = {
            ...document,
            tees: [],
            holes: [],
            warnings: [],
            acknowledgedWarnings: [],
            excludedTeeIndexes: [],
            parseFailed: true,
            audit: [...document.audit, { event: "replaced_image", actorId: input.actorId, at: now().toISOString() }],
          };
          const result = await db.update(courseScorecardImports).set({ stagedScorecardImageHandle: input.intent.stagedScorecardImageHandle, stagedImageDeletionHandles: [...(row.stagedImageDeletionHandles ?? []), row.stagedScorecardImageHandle], document: failedReplacement, revision: row.revision + 1, expiresAt: new Date(now().getTime() + IMPORT_LIFETIME_MS), updatedAt: now(), lastEditedByUserId: input.actorId }).where(and(eq(courseScorecardImports.id, row.id), eq(courseScorecardImports.status, "paused"), eq(courseScorecardImports.revision, row.revision))).returning();
          if (!result[0]) return revisionConflict(row.id);
          return currentOutcome(row.id);
        }
      }
      if (document.parseFailed) return { outcome: "rejected", reason: "invalid_resolution" };
      const resolution = input.intent;
      const teeCorrections = resolution.corrections?.tees ?? {};
      const holeCorrections = resolution.corrections?.holes ?? {};
      const teeResolutions = resolution.teeResolutions ?? {};
      const placeholderResolutions = resolution.placeholderResolutions ?? {};
      const mergedTeeResolutions = { ...document.teeResolutions, ...teeResolutions };
      const mergedPlaceholderResolutions = { ...document.placeholderResolutions, ...placeholderResolutions };
      const allowedTeeIds = new Set(document.tees.map((_, index) => teeIdFor(index)));
      const allowedHoleIds = new Set(document.holes.map((_, index) => holeIdFor(index)));
      if (
        Object.entries(teeCorrections).some(([id, correction]) => !allowedTeeIds.has(id) || !isTeeCorrection(correction)) ||
        Object.entries(holeCorrections).some(([id, correction]) => !allowedHoleIds.has(id) || !isHoleCorrection(correction)) ||
        Object.entries(teeResolutions).some(([id, value]) => !allowedTeeIds.has(id) || !value || (value.kind !== "new" && (value.kind !== "existing" || !Number.isInteger(value.teeId) || !(document.existingTees ?? []).some((tee) => tee.id === value.teeId)))) ||
        Object.entries(placeholderResolutions).some(([id, value]) => !(document.existingTees ?? []).some((tee) => tee.id === Number(id) && isPlaceholderTee(tee.name)) || !value || (value.kind !== "keep" && (value.kind !== "map" || !allowedTeeIds.has(value.teeId) || (mergedTeeResolutions[value.teeId] != null && mergedTeeResolutions[value.teeId].kind !== "new") || (resolution.excludeTees ?? []).includes(value.teeId)))) ||
        new Set(Object.values(mergedPlaceholderResolutions).flatMap((value) => value.kind === "map" ? [value.teeId] : [])).size !== Object.values(mergedPlaceholderResolutions).filter((value) => value.kind === "map").length ||
        new Set(Object.values(mergedTeeResolutions).flatMap((value) => value.kind === "existing" ? [value.teeId] : [])).size !== Object.values(mergedTeeResolutions).filter((value) => value.kind === "existing").length ||
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
        teeResolutions: mergedTeeResolutions,
        placeholderResolutions: mergedPlaceholderResolutions,
        // A correction can change what a parser warning refers to. Requiring
        // acknowledgement again is conservative and prevents stale approval.
        acknowledgedWarnings: hasCorrection ? [] : [...new Set([...(document.acknowledgedWarnings ?? []), ...(resolution.acknowledgeWarnings ?? [])])],
        audit: [...document.audit, { event: "resolved", actorId: input.actorId, at: now().toISOString(), decision: resolution }],
      };
      const expiresAt = new Date(now().getTime() + IMPORT_LIFETIME_MS);
      const result = await db.update(courseScorecardImports).set({ document: updated, revision: row.revision + 1, expiresAt, updatedAt: now(), lastEditedByUserId: input.actorId }).where(and(eq(courseScorecardImports.id, row.id), eq(courseScorecardImports.status, "paused"), eq(courseScorecardImports.revision, row.revision))).returning();
      if (!result[0]) return revisionConflict(row.id);
      const updatedRow = result[0];
      if (await publishCourse(updatedRow)) {
        const [published] = await db.select().from(courseScorecardImports).where(eq(courseScorecardImports.id, row.id)).limit(1);
        return { outcome: "published", import: toView(published!), handle: row.reservedHandle ?? readDocument(row.document).handle! };
      }
      return currentOutcome(row.id);
    },

    async cleanup({ actorId }: { actorId: string }) {
      if (!(await administrator(actorId))) return { outcome: "rejected" as const, reason: "forbidden" };
      await cleanupExpiredAndStagedImages();
      return { outcome: "cleaned" as const };
    },

    async cleanupSystem() {
      await cleanupExpiredAndStagedImages();
      return { outcome: "cleaned" as const };
    },
  };
}
