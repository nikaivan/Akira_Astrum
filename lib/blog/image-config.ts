import type { NextConfig } from "next";

/** Ruta pública del bucket de imágenes de las entradas (el nombre del bucket está en la migración de Storage). */
export const STORAGE_IMAGE_PATH = "/storage/v1/object/public/post-images/";

/**
 * Origen https limpio de una URL (sin usuario, sin contraseña y sin puerto), o null.
 * Es la única fuente del host de Storage permitido para imágenes.
 */
export function httpsOrigin(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const clean = parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port && parsed.hostname;
    return clean ? parsed.origin : null;
  } catch {
    return null;
  }
}

/** Configuración de next/image: solo el Storage público del proyecto; sin variable válida, ningún host. */
export function buildImageConfig(supabaseUrl: string | null | undefined): NonNullable<NextConfig["images"]> {
  const origin = httpsOrigin(supabaseUrl);
  if (!origin) return { remotePatterns: [] };
  return {
    remotePatterns: [
      { protocol: "https", hostname: new URL(origin).hostname, port: "", pathname: `${STORAGE_IMAGE_PATH}**`, search: "" },
    ],
  };
}
