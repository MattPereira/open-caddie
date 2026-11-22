import { notFound } from "next/navigation";

import { createBrandIcon } from "@/app/brand-icon";

const variants = {
  "192": { size: 192, shape: "circle", glyphScale: 0.7 },
  "512": { size: 512, shape: "circle", glyphScale: 0.7 },
  maskable: { size: 512, shape: "square", glyphScale: 0.55 },
} as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(variants).map((variant) => ({ variant }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/pwa-icons/[variant]">,
) {
  const { variant } = await params;
  if (!(variant in variants)) notFound();

  return createBrandIcon(variants[variant as keyof typeof variants]);
}
