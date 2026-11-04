import { httpsOrigin, STORAGE_IMAGE_PATH } from "./image-config";

/** Nombre generado al subir una imagen: UUID en minúsculas con una extensión permitida (sin anclas, para poder buscarlo dentro de un texto). */
export const GENERATED_NAME_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(?:jpg|png|webp)";
const GENERATED_NAME = new RegExp(`^${GENERATED_NAME_SOURCE}$`);

export const isGeneratedImageName = (name: string): boolean => GENERATED_NAME.test(name);

/**
 * Nombre del archivo si `src` es la URL absoluta de una imagen generada del bucket público de este proyecto (mismo origen, sin
 * usuario, contraseña, consulta ni fragmento); si no, null. Es la única regla de «imagen del proyecto» que pinta el blog.
 */
export function projectImageName(src: string | null | undefined, origin: string | null | undefined): string | null {
  const base = httpsOrigin(origin);
  if (!base || !src) return null;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null; // relativa, sin protocolo o inválida
  }
  if (url.origin !== base || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(STORAGE_IMAGE_PATH)) return null;
  const name = url.pathname.slice(STORAGE_IMAGE_PATH.length);
  return isGeneratedImageName(name) ? name : null;
}

/** URL pública de una portada, o null si el nombre no es el generado o el origen no es un https limpio. */
export function coverImageUrl(origin: string | null | undefined, path: string | null): string | null {
  const base = httpsOrigin(origin);
  if (!base || path === null || !isGeneratedImageName(path)) return null;
  return `${base}${STORAGE_IMAGE_PATH}${path}`;
}
