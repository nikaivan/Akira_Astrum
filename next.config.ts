import type { NextConfig } from "next";
import { PRIVATE_HEADERS } from "./lib/auth/private-headers";

const privateHeaders = [...PRIVATE_HEADERS];

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/login", headers: privateHeaders },
      { source: "/admin/:path*", headers: privateHeaders },
    ];
  },
};

export default nextConfig;
