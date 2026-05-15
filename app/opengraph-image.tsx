import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Open Caddie — a modern golf scorekeeper";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const damion = await readFile(
    join(process.cwd(), "assets/Damion-Regular.ttf"),
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "96px 96px 96px 64px",
        background: "#0b3d2e",
        color: "white",
      }}
    >
      <div
        style={{
          fontFamily: "Damion",
          fontSize: 220,
          lineHeight: 1,
          whiteSpace: "nowrap",
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
