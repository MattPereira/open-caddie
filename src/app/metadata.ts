import type { Metadata } from "next";

export const siteName = "Open Caddie";
export const siteDescription =
  "A modern golf score keeper for singles, groups, and tournament play.";

export function createPageMetadata({
  title,
  description = siteDescription,
}: {
  title: string;
  description?: string;
}): Metadata {
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
