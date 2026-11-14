import { NextResponse } from "next/server";

import { courseScorecardImports } from "@/modules/courses/scorecard-import";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  await courseScorecardImports.cleanupSystem();
  return NextResponse.json({ ok: true });
}
