import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Open Caddie — a modern golf scorekeeper";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [damion, bg] = await Promise.all([
    readFile(join(process.cwd(), "assets/Damion-Regular.ttf")),
    readFile(join(process.cwd(), "public/poipu-bay.jpg")),
  ]);
  const bgDataUrl = `data:image/jpeg;base64,${bg.toString("base64")}`;

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
      <img
        src={bgDataUrl}
        alt=""
        width={size.width}
        height={size.height}
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
        Open Caddie
      </div>
    </div>,
    {
      ...size,
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
