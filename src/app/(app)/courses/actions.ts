"use server";

import * as courses from "@/modules/courses";
import {
  courseScorecardImports,
  type HoleCorrection,
  type ImportOutcome,
  type CourseScorecardImportView,
  type TeeCorrection,
} from "@/modules/courses/scorecard-import";
import { getCurrentPlayer, getSignedInPlayer } from "@/modules/players";
import {
  CourseCreateInputSchema,
  CourseUpdateSchema,
  type CourseCreateInputValues,
  type CourseUpdateValues,
} from "./schema";

export type CourseScorecardImportResult =
  | { outcome: "published"; handle: string }
  | { outcome: "paused"; import: CourseScorecardImportView }
  | { outcome: "stale"; import: CourseScorecardImportView }
  | { outcome: "cancelled" }
  | { outcome: "rejected"; error: string };

const SIGNED_OUT = { ok: false, error: "You must be signed in." } as const;

function toActionResult(result: ImportOutcome): CourseScorecardImportResult {
  if (result.outcome === "published") return { outcome: "published", handle: result.handle };
  if (result.outcome === "paused" || result.outcome === "cancelled") return result;
  if (result.outcome === "stale") return result;
  return { outcome: "rejected", error: result.reason };
}

export async function startCourseScorecardImport(
  values: CourseCreateInputValues,
): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentPlayer();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const parsed = CourseCreateInputSchema.safeParse(values);
  if (!parsed.success) {
    return { outcome: "rejected", error: parsed.error.issues[0].message };
  }
  const result = await courseScorecardImports.start({
    actorId: actor.id,
    target: { kind: "new", name: parsed.data.name },
    stagedCourseImageHandle: parsed.data.imgUrl,
    stagedScorecardImageHandle: parsed.data.scorecardImgUrl,
  });
  return toActionResult(result);
}

export async function startExistingCourseScorecardImport(input: {
  courseId: number;
  stagedScorecardImageHandle: string;
}): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentPlayer();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.start({
    actorId: actor.id,
    target: { kind: "existing", courseId: input.courseId },
    stagedScorecardImageHandle: input.stagedScorecardImageHandle,
  });
  return toActionResult(result);
}

export async function cancelCourseScorecardImport(input: {
  importId: string;
  expectedRevision: number;
}): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentPlayer();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.continue({
    actorId: actor.id,
    importId: input.importId,
    expectedRevision: input.expectedRevision,
    intent: { kind: "cancel" },
  });
  return toActionResult(result);
}

export async function continueCourseScorecardImport(input: {
  importId: string;
  expectedRevision: number;
  teeMetadata?: Record<string, { rating: number; slope: number }>;
  acknowledgeWarnings?: string[];
  corrections?: {
    tees?: Record<string, TeeCorrection>;
    holes?: Record<string, HoleCorrection>;
  };
  excludeTees?: string[];
  teeResolutions?: Record<string, { kind: "new" } | { kind: "existing"; teeId: number }>;
  placeholderResolutions?: Record<string, { kind: "keep" } | { kind: "map"; teeId: string }>;
}): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentPlayer();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.continue({
    actorId: actor.id,
    importId: input.importId,
    expectedRevision: input.expectedRevision,
    intent: {
      kind: "resolve",
      teeMetadata: input.teeMetadata,
      acknowledgeWarnings: input.acknowledgeWarnings,
      corrections: input.corrections,
      excludeTees: input.excludeTees,
      teeResolutions: input.teeResolutions,
      placeholderResolutions: input.placeholderResolutions,
    },
  });
  return toActionResult(result);
}

export async function retryCourseScorecardImport(input: {
  importId: string;
  expectedRevision: number;
}): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentPlayer();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.continue({
    actorId: actor.id,
    importId: input.importId,
    expectedRevision: input.expectedRevision,
    intent: { kind: "retry_parsing" },
  });
  return toActionResult(result);
}

export async function replaceCourseScorecardImport(input: {
  importId: string;
  expectedRevision: number;
  stagedScorecardImageHandle: string;
}): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentPlayer();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.continue({
    actorId: actor.id,
    importId: input.importId,
    expectedRevision: input.expectedRevision,
    intent: { kind: "replace_scorecard_image", stagedScorecardImageHandle: input.stagedScorecardImageHandle },
  });
  return toActionResult(result);
}

export async function inspectCourseScorecardImport(
  importId: string,
): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentPlayer();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.inspect({ actorId: actor.id, importId });
  return toActionResult(result);
}

export async function updateCourse(
  values: CourseUpdateValues,
): Promise<courses.CourseUpdateResult> {
  const actor = await getSignedInPlayer();
  if (!actor) return SIGNED_OUT;

  const parsed = CourseUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return courses.updateCourse(actor.id, parsed.data);
}

export async function deleteCourse(
  id: number,
): Promise<courses.CourseDeleteResult> {
  const actor = await getSignedInPlayer();
  if (!actor) return SIGNED_OUT;

  return courses.deleteCourse(actor.id, id);
}
