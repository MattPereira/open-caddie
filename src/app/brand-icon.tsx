import { ImageResponse } from "next/og";

// Image generation can't read CSS tokens, so the brand black is spelled out.
const BRAND_BACKGROUND = "#000";

const CLUB_HEAD =
  "M7.47095 17.263L12 20.9742C11.6197 21.3637 11.255 21.7646 10.7178 21.9214C10.4486 22 10.1597 22 9.58202 22H6.64577C5.12431 22 3.69593 21.514 3.15891 19.9348C2.65447 18.4514 3.35188 15.9891 5.23816 16C5.93452 16.0041 6.44666 16.4237 7.47095 17.263Z";
const CLUB_SHAFT = "M12 21L16.5 10";
const CLUB_GRIP =
  "M17.6206 3.42288L16.1333 9.00001C16.0557 9.29111 16.1934 9.59668 16.4628 9.73142C16.7642 9.8821 17.1308 9.77111 17.298 9.47856L20.1617 4.46705C20.5954 3.70809 20.2263 2.7421 19.397 2.46568C18.6397 2.21323 17.8263 2.65152 17.6206 3.42288Z";

// Satori renders <svg> children as plain markup, so the paths are listed
// directly rather than through a component.
const clubPaths = [CLUB_HEAD, CLUB_SHAFT, CLUB_GRIP].map((d) => (
  <path key={d} d={d} />
));

export type BrandIconOptions = {
  size: number;
  shape: "circle" | "square";
  // Fraction of the canvas the crossed clubs fill. Maskable icons need it
  // inside the 80% safe zone because launchers crop to their own shape.
  glyphScale: number;
};

export function createBrandIcon({ size, shape, glyphScale }: BrandIconOptions) {
  const glyphSize = Math.round(size * glyphScale);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_BACKGROUND,
        borderRadius: shape === "circle" ? "9999px" : 0,
      }}
    >
      <svg
        width={glyphSize}
        height={glyphSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g>{clubPaths}</g>
        <g transform="translate(24,0) scale(-1,1)">{clubPaths}</g>
      </svg>
    </div>,
    { width: size, height: size },
  );
}
