import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { siteName } from "@/lib/metadata";

export const openGraphImageSize = { width: 1200, height: 630 };
export const openGraphImageContentType = "image/png";

type OpenCaddieOgImageOptions = {
  title: string;
  subtitle?: string | null;
  kicker?: string | null;
  imageUrl?: string | null;
};

export async function createOpenCaddieOgImage({
  imageUrl,
}: OpenCaddieOgImageOptions) {
  const [damion, bgSrc] = await Promise.all([
    readFile(join(process.cwd(), "assets/Damion-Regular.ttf")),
    getImageSrc(imageUrl),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        color: "white",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bgSrc}
        alt=""
        width={openGraphImageSize.width}
        height={openGraphImageSize.height}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "bottom",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.15), rgba(0,0,0,0.4))",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Damion",
          fontSize: 240,
          lineHeight: 1,
          whiteSpace: "nowrap",
          textShadow: "0 4px 24px rgba(0,0,0,0.6)",
        }}
      >
        {siteName}
      </div>
    </div>,
    {
      ...openGraphImageSize,
      fonts: [
        {
          name: "Damion",
          data: damion,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}

async function getImageSrc(imageUrl: string | null | undefined) {
  if (!imageUrl) return getFallbackImageSrc();

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) return getFallbackImageSrc();

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (contentType.includes("image/webp")) {
      return getOptimizedImageSrc(imageUrl);
    }

    const image = Buffer.from(await response.arrayBuffer());

    return `data:${contentType};base64,${image.toString("base64")}`;
  } catch {
    return getFallbackImageSrc();
  }
}

async function getOptimizedImageSrc(imageUrl: string) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) return getFallbackImageSrc();

  const optimizerUrl = new URL(`/_next/image`, `${protocol}://${host}`);
  optimizerUrl.searchParams.set("url", imageUrl);
  optimizerUrl.searchParams.set("w", String(openGraphImageSize.width));
  optimizerUrl.searchParams.set("q", "75");

  const response = await fetch(optimizerUrl, {
    headers: { accept: "image/jpeg" },
  });

  if (!response.ok) return getFallbackImageSrc();

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const image = Buffer.from(await response.arrayBuffer());

  return `data:${contentType};base64,${image.toString("base64")}`;
}

async function getFallbackImageSrc() {
  const bg = await readFile(join(process.cwd(), "public/poipu-bay.jpg"));

  return `data:image/jpeg;base64,${bg.toString("base64")}`;
}
