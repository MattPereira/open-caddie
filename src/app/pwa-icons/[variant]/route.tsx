import { notFound } from "next/navigation";

import { createBrandIcon } from "@/app/brand-icon";
import { isPwaIconVariant, pwaIconVariants } from "@/app/pwa-icons/variants";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(pwaIconVariants).map((variant) => ({ variant }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/pwa-icons/[variant]">,
) {
  const { variant } = await params;
  if (!isPwaIconVariant(variant)) notFound();

  return createBrandIcon(pwaIconVariants[variant]);
}
