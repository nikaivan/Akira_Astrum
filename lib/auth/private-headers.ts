/** Cabeceras de todo lo privado (/login y /admin): ni se indexa ni se guarda en caché (A01, A07). */
export const PRIVATE_HEADERS = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store" },
] as const;
