import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import * as messages from "@/lib/admin/messages";
import { fail, guarded, invalid, type Failure, type Parsed } from "@/lib/admin/result";
import type { RateLimiter } from "@/lib/auth/rate-limit";
import { coverImageUrl } from "@/lib/blog/cover";
import { httpsOrigin } from "@/lib/blog/image-config";
import { imageMarkdown } from "@/lib/posts/content-images";
import { removeCoverFile, uploadCover } from "@/lib/storage/covers";
import { POST_LIMITS } from "./schema";
import { inspectCover } from "./service";

/**
 * Subida de una imagen para el contenido de una entrada. Reutiliza la inspección y la subida de la portada (mismas reglas,
 * mismo límite de intentos, mismo bucket) y no escribe en la base de datos: la imagen solo se «usa» cuando el admin guarda
 * el texto que la menciona.
 */
export type ImageFieldErrors = { image?: string; alt?: string; form?: string };
export type ImageResult = { ok: true; url: string; alt: string; markdown: string } | Failure<ImageFieldErrors>;

type Context = { supabase: SupabaseClient; userId: string; input: unknown; limiter?: RateLimiter; storageOrigin?: string | null };
type ImageForm = { image: File; alt: string };

// Un campo de archivo sin selección llega como un archivo vacío sin nombre real (ver el esquema de la portada).
const unselected = (value: unknown) => !(value instanceof File) || (value.size === 0 && (value.name === "" || value.name === "undefined"));
const CONTROL = /[\u0000-\u001f\u007f]/;

const FORM = z.strictObject({ image: z.unknown().optional(), alt: z.unknown().optional() });

function parseImageForm(input: unknown): Parsed<ImageForm, ImageFieldErrors> {
  const parsed = FORM.safeParse(input);
  if (!parsed.success || Array.isArray(parsed.data.image) || (parsed.data.alt !== undefined && typeof parsed.data.alt !== "string")) {
    return { success: false, errors: { form: messages.INVALID_REQUEST } };
  }
  const errors: ImageFieldErrors = {};
  const alt = typeof parsed.data.alt === "string" ? parsed.data.alt.trim() : "";
  if (alt === "") errors.alt = messages.IMAGE_ALT_REQUIRED;
  else if (alt.length > POST_LIMITS.coverAlt || CONTROL.test(alt)) errors.alt = messages.IMAGE_ALT_INVALID;
  const image = parsed.data.image;
  if (unselected(image)) errors.image = messages.IMAGE_FILE_REQUIRED;
  if (errors.alt || errors.image) return { success: false, errors };
  return { success: true, data: { image: image as File, alt } };
}

export function performUploadPostImage({ supabase, userId, input, limiter, storageOrigin }: Context): Promise<ImageResult> {
  return guarded(async () => {
    const parsed = parseImageForm(input);
    if (!parsed.success) return invalid(parsed.errors);
    const { image, alt } = parsed.data;

    // Sin un origen de Storage válido la imagen no se podría mostrar: no se sube.
    const origin = httpsOrigin(storageOrigin);
    if (!origin) return fail(messages.GENERIC_ERROR);

    const inspected = await inspectCover(image, userId, limiter);
    if (!inspected.ok) return inspected.fieldErrors?.cover ? fail(inspected.message, { image: inspected.fieldErrors.cover }) : fail(inspected.message);

    const uploaded = await uploadCover(supabase, inspected.bytes, inspected.image);
    if (!uploaded.ok) return fail(messages.GENERIC_ERROR);
    const url = coverImageUrl(origin, uploaded.path);
    if (!url) {
      await removeCoverFile(supabase, uploaded.path);
      return fail(messages.GENERIC_ERROR);
    }
    return { ok: true, url, alt, markdown: imageMarkdown(url, alt) };
  });
}
