import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { openGraphImageContentType, openGraphImageSize } from "@/app/og-image";
import { event } from "./content";

// A bespoke preview rather than createOpenCaddieOgImage: this link gets pasted
// into group texts, where the preview needs to say what the event is rather than
// carry the Open Caddie wordmark. Text sits on its own dark panel because the
// flyer already carries the headline in display type — overlaying the two
// collides.

export const alt = "Driven to Serve golf tournament fundraiser";
export const size = openGraphImageSize;
export const contentType = openGraphImageContentType;

// Hand-tuned crop of the original flyer (1320x2017) onto the portrait of
// Captain Cochnauer, expressed as the scaled image size and its offset inside
// the panel. Tied to that source's dimensions — hence ogSourceImage rather than
// the already-cropped heroImage.
const portraitPanelWidth = 470;
const portraitCrop = { width: 1500, height: 2292, left: -920, top: -85 };

export default async function Image() {
  const flyer = await readFile(
    join(process.cwd(), "public", event.ogSourceImage),
  );
  const flyerDataUrl = `data:image/jpeg;base64,${flyer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#0a0a0a",
          color: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: size.width - portraitPanelWidth,
            height: "100%",
            padding: "0 60px",
          }}
        >
          <div style={{ fontSize: 23, letterSpacing: 3, color: "#fb923c" }}>
            {event.ogKicker.toUpperCase()}
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -2,
            }}
          >
            {event.name}
          </div>
          <div style={{ marginTop: 22, fontSize: 30, color: "#d4d4d4" }}>
            Golf tournament fundraiser for
          </div>
          <div style={{ fontSize: 30, color: "#d4d4d4" }}>
            Fire Captain Derek Cochnauer
          </div>
        </div>

        <div
          style={{
            display: "flex",
            position: "relative",
            width: portraitPanelWidth,
            height: "100%",
            overflow: "hidden",
          }}
        >
          <img
            src={flyerDataUrl}
            alt=""
            width={portraitCrop.width}
            height={portraitCrop.height}
            style={{
              position: "absolute",
              left: portraitCrop.left,
              top: portraitCrop.top,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, rgba(10,10,10,1), rgba(10,10,10,0) 28%)",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
