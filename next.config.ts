import type { NextConfig } from "next";
import { PRIVATE_HEADERS } from "./lib/auth/private-headers";
import { buildImageConfig } from "./lib/blog/image-config";

const privateHeaders = [...PRIVATE_HEADERS];

// Las páginas públicas del blog leen datos en cada petición y nunca se guardan en caché.
const noStore = [{ key: "Cache-Control", value: "no-store" }];

const nextConfig: NextConfig = {
  // next/image solo admite el Storage público del proyecto; sin la variable, ningún host.
  images: buildImageConfig(process.env.NEXT_PUBLIC_SUPABASE_URL),
  experimental: {
    // Límite del cuerpo de las Server Actions (por defecto 1 MB, ya con las cabeceras multipart). La portada admite hasta 2 MiB:
    // 2 MiB + hasta ~200 KB de contenido + ~20 KB de sobrecarga son unos 2,3 MiB. Con 3 MB un archivo de 2,5 MB llega al
    // servidor y recibe su mensaje claro; uno mayor lo para Next (el navegador avisa antes). Es global: afecta a todas las acciones.
    serverActions: { bodySizeLimit: "3mb" },
  },
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
