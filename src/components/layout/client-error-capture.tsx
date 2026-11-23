"use client";

import { startCapturingClientErrors } from "@/modules/problem-reports/client";

// At module load rather than in an effect, so errors thrown while the page
// hydrates are caught too.
startCapturingClientErrors();

export function ClientErrorCapture() {
  return null;
}
