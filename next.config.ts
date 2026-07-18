import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["lowdb"],
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
