import { httpsOrigin, STORAGE_IMAGE_PATH } from "./image-config";

/** Nombre generado al subir una imagen: UUID en minúsculas con una extensión permitida. */
const GENERATED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export const isGeneratedImageName = (name: string): boolean => GENERATED_NAME.test(name);

/** URL pública de una portada, o null si el nombre no es el generado o el origen no es un https limpio. */
export function coverImageUrl(origin: string | null | undefined, path: string | null): string | null {
  const base = httpsOrigin(origin);
  if (!base || path === null || !isGeneratedImageName(path)) return null;
  return `${base}${STORAGE_IMAGE_PATH}${path}`;
}
