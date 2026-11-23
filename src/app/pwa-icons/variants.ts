import type { BrandIconOptions } from "@/app/brand-icon";

export const pwaIconVariants = {
  "circle-192": { size: 192, shape: "circle", glyphScale: 0.7 },
  "circle-512": { size: 512, shape: "circle", glyphScale: 0.7 },
  maskable: { size: 512, shape: "square", glyphScale: 0.55 },
} as const satisfies Record<string, BrandIconOptions>;

export type PwaIconVariant = keyof typeof pwaIconVariants;

export function isPwaIconVariant(value: string): value is PwaIconVariant {
  return value in pwaIconVariants;
}
