import { safeDeleteBlob } from "@/lib/images/blob";
import { DEFAULT_COURSE_SCORECARD_MODEL, parseScorecardImage } from "./parser";
import { createCourseScorecardImport } from "./workflow";

async function fetchImageBytes(
  url: string,
): Promise<{ buffer: Buffer; mediaType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const mediaType =
      response.headers.get("content-type")?.split(";")[0].trim() ||
      "image/webp";
    return { buffer, mediaType };
  } catch {
    return null;
  }
}

export const courseScorecardImports = createCourseScorecardImport({
  async parseScorecardImage(stagedImageHandle) {
    const image = await fetchImageBytes(stagedImageHandle);
    if (!image) throw new Error("Could not retrieve staged scorecard image");
    const parsed = await parseScorecardImage(image.buffer, image.mediaType);
    return {
      scorecard: parsed.parsed,
      warnings: parsed.sumChecks,
      parserModel: DEFAULT_COURSE_SCORECARD_MODEL,
    };
  },
  deleteStagedImage: safeDeleteBlob,
});
