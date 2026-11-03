import type { NextConfig } from "next";
import { PRIVATE_HEADERS } from "./lib/auth/private-headers";
import { buildImageConfig } from "./lib/blog/image-config";

const privateHeaders = [...PRIVATE_HEADERS];

// Las páginas públicas del blog leen datos en cada petición y nunca se guardan en caché.
const noStore = [{ key: "Cache-Control", value: "no-store" }];

const nextConfig: NextConfig = {
  // next/image solo admite el Storage público del proyecto; sin la variable, ningún host.
  images: buildImageConfig(process.env.NEXT_PUBLIC_SUPABASE_URL),
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
      { source: "/compatibilidad", headers: noStore },
      { source: "/", headers: noStore },
      { source: "/blog/:path*", headers: noStore },
      { source: "/categorias/:path*", headers: noStore },
    ];
  },
};

export default nextConfig;
