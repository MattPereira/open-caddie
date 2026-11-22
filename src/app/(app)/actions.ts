"use server";

import { getSignedInPlayer } from "@/modules/players/server";
import {
  fileProblemReport,
  type ProblemReportResult,
  type ProblemReportSubmission,
} from "@/modules/problem-reports/server";

export async function reportProblem(
  values: ProblemReportSubmission,
): Promise<ProblemReportResult> {
  const player = await getSignedInPlayer();
  return fileProblemReport(player?.id ?? null, values);
}
