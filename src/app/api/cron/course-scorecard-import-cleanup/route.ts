import { NextResponse } from "next/server";

import { cleanupExpiredCourseScorecardImportsFromScheduler } from "@/app/(app)/courses/actions";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  await cleanupExpiredCourseScorecardImportsFromScheduler();
  return NextResponse.json({ ok: true });
}
