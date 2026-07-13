import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getImageUploadMaxBytes } from "@/lib/images/upload-limits";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

type UploadTarget =
  | { kind: "user"; id: string }
  | { kind: "course"; id: string }
  | { kind: "round-scorecard"; id: string };

function parseUploadTarget(pathname: string): UploadTarget | null {
  const userMatch = pathname.match(/^users\/([^/]+)\//);
  if (userMatch) return { kind: "user", id: userMatch[1] };

  const courseMatch = pathname.match(/^courses\/([^/]+)\//);
  if (courseMatch) return { kind: "course", id: courseMatch[1] };

  const roundScorecardCourseMatch = pathname.match(
    /^round-scorecards\/[^/]+\/([^/]+)\//,
  );
  if (roundScorecardCourseMatch) {
    return { kind: "round-scorecard", id: roundScorecardCourseMatch[1] };
  }

  const roundScorecardMatch = pathname.match(/^round-scorecards\/([^/]+)\//);
  if (roundScorecardMatch) {
    return { kind: "round-scorecard", id: roundScorecardMatch[1] };
  }

  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await auth();
        const me = session?.user;
        if (!me?.id) {
          throw new Error("Unauthorized");
        }

        const target = parseUploadTarget(pathname);
        if (!target) {
          throw new Error("Invalid upload path");
        }

        if (target.kind === "user") {
          const [currentUser] = await db
            .select({ username: users.username })
            .from(users)
            .where(eq(users.id, me.id))
            .limit(1);
          const isSelf =
            me.id === target.id || currentUser?.username === target.id;
          if (!isSelf && !me.isAdmin) {
            throw new Error("Forbidden");
          }
        } else if (target.kind === "course") {
          if (!me.isAdmin) {
            throw new Error("Forbidden");
          }
        } else if (target.kind === "round-scorecard") {
          const isSelf = me.id === target.id;
          if (!isSelf && !me.isAdmin) {
            throw new Error("Forbidden");
          }
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: getImageUploadMaxBytes(pathname),
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden"
          ? 403
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
