import type { MetadataRoute } from "next";

/** Manifiesto de la PWA (docs/design.md §6 bis): solo datos públicos, con `start_url` en la raíz y colores de la identidad «noche y marfil». */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Akira Astrum",
    short_name: "Akira Astrum",
    description: "Blog de astrología y calculadora de compatibilidad entre signos.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FBF8F3",
    theme_color: "#0B1026",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
