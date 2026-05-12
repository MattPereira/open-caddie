import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
