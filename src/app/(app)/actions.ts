"use server";

import { getSignedInPlayer } from "@/modules/players/server";
import type { ProblemReportInput } from "@/modules/problem-reports";
import {
  fileProblemReport,
  type ProblemReportResult,
} from "@/modules/problem-reports/server";

export async function reportProblem(
  values: ProblemReportInput,
): Promise<ProblemReportResult> {
  const player = await getSignedInPlayer();
  return fileProblemReport(player?.id ?? null, values);
}
