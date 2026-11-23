"use server";

import { getSignedInPlayer } from "@/modules/players/server";
import { BugReportSchema } from "@/modules/bug-reports";
import {
  fileBugReport,
  type BugReportResult,
  type BugReportSubmission,
} from "@/modules/bug-reports/server";

const SIGNED_OUT = { ok: false, error: "You must be signed in." } as const;

export async function reportBug(
  values: BugReportSubmission,
): Promise<BugReportResult> {
  const actor = await getSignedInPlayer();
  if (!actor) return SIGNED_OUT;

  const parsed = BugReportSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { path, viewport, clientErrors } = values;
  return fileBugReport(actor.id, {
    ...parsed.data,
    path,
    viewport,
    clientErrors,
  });
}
