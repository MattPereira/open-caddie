import type { MetadataRoute } from "next";

// Only the cached home page is crawlable; every other page reads Postgres and a
// crawler hit wakes the Neon compute. OG images stay allowed so link previews
// from bots that honor robots.txt (e.g. Twitterbot) keep working.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/opengraph-image", "/*/opengraph-image"],
      disallow: "/",
    },
  };
}
