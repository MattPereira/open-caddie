import type { MetadataRoute } from "next";

import { lightBackground } from "@/app/theme-colors";
import { siteDescription, siteName } from "@/app/metadata";
import { pwaIconVariants } from "@/app/pwa-icons/variants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: siteName,
    description: siteDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: lightBackground,
    theme_color: lightBackground,
    icons: Object.entries(pwaIconVariants).map(
      ([variant, { size, shape }]) => ({
        src: `/pwa-icons/${variant}`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: shape === "square" ? "maskable" : "any",
      }),
    ),
  };
}
