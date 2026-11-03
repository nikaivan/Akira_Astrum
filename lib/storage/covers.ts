import type { SupabaseClient } from "@supabase/supabase-js";
import { isGeneratedImageName } from "@/lib/blog/cover";
import type { ValidImage } from "./image-validation";

/**
 * ÚNICO punto de la aplicación que habla con Storage. Se usa siempre la sesión del admin (las políticas del bucket
 * deciden); nunca la clave de servicio. El nombre lo genera el servidor y el tipo sale del contenido ya validado.
 */
export const COVER_BUCKET = "post-images";

export function generateCoverName(extension: ValidImage["extension"]): string {
  return `${crypto.randomUUID()}.${extension}`;
}

/** Sube una imagen ya validada con un nombre nuevo y sin sobrescribir nada. Cualquier fallo es `{ ok: false }`, sin detalles. */
export async function uploadCover(supabase: SupabaseClient, bytes: Uint8Array, image: ValidImage): Promise<{ ok: true; path: string } | { ok: false }> {
  const path = generateCoverName(image.extension);
  try {
    const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, bytes, { contentType: image.contentType, upsert: false });
    return error ? { ok: false } : { ok: true, path };
  } catch {
    return { ok: false };
  }
}

/**
 * Borra una portada. Sin ruta no hay nada que borrar (true). Solo se aceptan nombres generados: aunque la base de
 * datos tuviera otra cosa, no se llama a Storage con ella (false). Un fallo devuelve false para que quien llama avise.
 */
export async function removeCoverFile(supabase: SupabaseClient, path: string | null | undefined): Promise<boolean> {
  if (path === null || path === undefined) return true;
  if (!isGeneratedImageName(path)) return false;
  try {
    const { error } = await supabase.storage.from(COVER_BUCKET).remove([path]);
    return !error;
  } catch {
    return false;
  }
}
