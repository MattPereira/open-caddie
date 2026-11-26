import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The agents' screenshots run in CI, where the badge covers the page.
  devIndicators: process.env.CI ? false : undefined,
  // setup-agent runs one `next start` per database from a copy of the build.
  // Servers sharing a distDir share its data cache, so one database's cached
  // rows (`unstable_cache`) would show on another's server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // `next dev` adds its distDir's types to the tsconfig it reads, so each
  // setup-agent server with its own distDir reads its own (gitignored)
  // tsconfig that extends ours, leaving ours untouched. Turbopack can't read
  // one inside the distDir.
  typescript: {
    tsconfigPath: process.env.NEXT_TSCONFIG_PATH || "tsconfig.json",
  },
  // `pg` serves the local Postgres (DATABASE_DRIVER=node-postgres) in dev and
  // tests; deployments use neon-serverless. Keep it out of the Next bundle
  // graph, otherwise Turbopack tries to bundle its Node built-ins
  // (dns/fs/net/tls) and the build fails.
  serverExternalPackages: ["pg"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "contra-costa-golf-club.s3.us-west-1.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "t4.ftcdn.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ccgc.vercel.app",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "matt-pereira.vercel.app",
        pathname: "/**",
      },
      // for default images when user creates account with google sign in
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
