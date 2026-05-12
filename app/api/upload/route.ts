import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { auth } from "@/auth";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

function parseTargetUserId(pathname: string): string | null {
  const match = pathname.match(/^users\/([^/]+)\//);
  return match ? match[1] : null;
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

        const targetUserId = parseTargetUserId(pathname);
        if (!targetUserId) {
          throw new Error("Invalid upload path");
        }

        const isSelf = me.id === targetUserId;
        if (!isSelf && !me.isAdmin) {
          throw new Error("Forbidden");
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_BYTES,
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
