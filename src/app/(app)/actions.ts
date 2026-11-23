"use server";

import { getSignedInPlayer } from "@/modules/players/server";
import { ProblemReportSchema } from "@/modules/problem-reports";
import {
  fileProblemReport,
  type ProblemReportResult,
  type ProblemReportSubmission,
} from "@/modules/problem-reports/server";

const SIGNED_OUT = { ok: false, error: "You must be signed in." } as const;

export async function reportProblem(
  values: ProblemReportSubmission,
): Promise<ProblemReportResult> {
  const actor = await getSignedInPlayer();
  if (!actor) return SIGNED_OUT;

  const parsed = ProblemReportSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { path, viewport, clientErrors } = values;
  return fileProblemReport(actor.id, {
    ...parsed.data,
    path,
    viewport,
    clientErrors,
  });
}
