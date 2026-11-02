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
      // Pública e indexable, pero nunca en caché: las fechas viajan en la petición.
      { source: "/compatibilidad", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
