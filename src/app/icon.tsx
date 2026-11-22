import { createBrandIcon } from "@/app/brand-icon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return createBrandIcon({
    size: size.width,
    shape: "circle",
    glyphScale: 0.7,
  });
}
