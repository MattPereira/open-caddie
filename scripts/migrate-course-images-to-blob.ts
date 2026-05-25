/**
 * Migrates course images from the legacy Contra Costa S3 bucket to Vercel Blob.
 *
 * Dry run:
 *   pnpm tsx scripts/migrate-course-images-to-blob.ts
 *
 * Apply changes:
 *   pnpm tsx scripts/migrate-course-images-to-blob.ts --apply
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";

const S3_ORIGIN = "https://contra-costa-golf-club.s3.us-west-1.amazonaws.com";

type Args = {
  apply: boolean;
};

type CourseRow = {
  id: number;
  handle: string;
  name: string;
  imgUrl: string | null;
};

function parseArgs(): Args {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    console.log(`
Usage:
  pnpm tsx scripts/migrate-course-images-to-blob.ts [--apply]

By default this only checks matching rows and prints what would change.
Use --apply to upload images to Vercel Blob and update courses.img_url.
`);
    process.exit(0);
  }

  return { apply: args.has("--apply") };
}

function getS3Key(imgUrl: string): string | null {
  if (!imgUrl.startsWith(`${S3_ORIGIN}/`)) return null;

  try {
    const url = new URL(imgUrl);
    if (url.origin !== S3_ORIGIN) return null;

    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    return key.length > 0 ? key : null;
  } catch {
    return null;
  }
}

function extensionForContentType(contentType: string | null): string {
  const mediaType = contentType?.split(";")[0]?.trim().toLowerCase();
  if (mediaType === "image/webp") return "webp";
  if (mediaType === "image/png") return "png";
  if (mediaType === "image/jpeg" || mediaType === "image/jpg") return "jpg";
  return "jpg";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function fetchImage(course: CourseRow): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
}> {
  if (!course.imgUrl) throw new Error("missing imgUrl");

  const response = await fetch(course.imgUrl);
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`unexpected content-type: ${contentType}`);
  }

  return {
    bytes: await response.arrayBuffer(),
    contentType,
  };
}

async function main() {
  const args = parseArgs();
  requireEnv("DATABASE_URL");
  if (args.apply) requireEnv("BLOB_READ_WRITE_TOKEN");

  const [{ db }, { courses }] = await Promise.all([
    import("../db"),
    import("../db/schema"),
  ]);

  const rows = await db
    .select({
      id: courses.id,
      handle: courses.handle,
      name: courses.name,
      imgUrl: courses.imgUrl,
    })
    .from(courses);

  const targets = rows.filter((course) => course.imgUrl && getS3Key(course.imgUrl));

  if (targets.length === 0) {
    console.log(`No courses found with imgUrl starting with ${S3_ORIGIN}/`);
    return;
  }

  console.log(
    `${args.apply ? "Applying" : "Dry run:"} ${targets.length} course image migration(s) from S3 to Vercel Blob.`,
  );

  let migrated = 0;
  let failed = 0;

  for (const course of targets) {
    const sourceKey = getS3Key(course.imgUrl ?? "");
    if (!sourceKey) continue;

    try {
      const image = await fetchImage(course);
      const ext = extensionForContentType(image.contentType);
      const targetPath = `courses/${course.handle}/image.${ext}`;

      if (!args.apply) {
        console.log(
          `- ${course.handle}: ${sourceKey} (${image.contentType}, ${formatBytes(image.bytes.byteLength)}) -> ${targetPath}`,
        );
        continue;
      }

      const uploaded = await put(targetPath, image.bytes, {
        access: "public",
        addRandomSuffix: true,
        contentType: image.contentType,
      });

      await db
        .update(courses)
        .set({ imgUrl: uploaded.url })
        .where(eq(courses.id, course.id));

      migrated += 1;
      console.log(`OK ${course.handle}: ${sourceKey} -> ${uploaded.url}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAIL ${course.handle}: ${sourceKey} (${message})`);
    }
  }

  if (!args.apply) {
    console.log("\nDry run complete. Re-run with --apply to upload and update the database.");
    return;
  }

  console.log(`\nDone. Migrated ${migrated}; failed ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
