import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "contra-costa-golf-club.s3.us-west-1.amazonaws.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
