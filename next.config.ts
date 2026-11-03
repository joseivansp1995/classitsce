import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.137.1', 'localhost', '*.local'],
  experimental: {
    serverActions: {
      bodySizeLimit: '16mb',
      allowedOrigins: ['localhost:3000', '192.168.137.1:3000'],
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
