import { createBrandIcon } from "@/app/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS rounds the corners itself, so the canvas stays square.
export default function AppleIcon() {
  return createBrandIcon({
    size: size.width,
    shape: "square",
    glyphScale: 0.62,
  });
}
