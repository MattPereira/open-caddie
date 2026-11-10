import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { getImageUploadMaxBytes } from "@/lib/images/upload-limits";
import { getPlayerById, getSignedInPlayer } from "@/lib/players/queries";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

type UploadTarget =
  | { kind: "player"; id: string }
  | { kind: "course"; id: string }
  | { kind: "round-scorecard"; id: string };

function parseUploadTarget(pathname: string): UploadTarget | null {
  // Profile images keep the `users/` Blob prefix: stored image URLs depend on it.
  const playerMatch = pathname.match(/^users\/([^/]+)\//);
  if (playerMatch) return { kind: "player", id: playerMatch[1] };

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
        const actor = await getSignedInPlayer();
        if (!actor) {
          throw new Error("Unauthorized");
        }

        const target = parseUploadTarget(pathname);
        if (!target) {
          throw new Error("Invalid upload path");
        }

        if (target.kind === "player") {
          const storedActor = await getPlayerById(actor.id);
          const isSelf =
            actor.id === target.id || storedActor?.username === target.id;
          if (!isSelf && !actor.isAdmin) {
            throw new Error("Forbidden");
          }
        } else if (target.kind === "course") {
          if (!actor.isAdmin) {
            throw new Error("Forbidden");
          }
        } else if (target.kind === "round-scorecard") {
          const isSelf = actor.id === target.id;
          if (!isSelf && !actor.isAdmin) {
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
