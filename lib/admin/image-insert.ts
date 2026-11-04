import * as messages from "@/lib/admin/messages";
import { MAX_IMAGE_BYTES } from "@/lib/storage/image-validation";

/**
 * Lo que hace el editor al insertar una imagen en el contenido: comprobaciones de comodidad antes de subir y, sobre todo,
 * una respuesta que falla cerrado: solo se devuelve una línea de Markdown si la subida salió bien y la línea tiene la
 * forma esperada. El servidor valida siempre el contenido del archivo.
 */
export type InsertFieldErrors = { image?: string; alt?: string };
export type InsertResult = { ok: true; markdown: string } | { ok: false; message: string; fieldErrors?: InsertFieldErrors };

type Params = { upload: (data: FormData) => Promise<unknown>; image: File | null; alt: string };

const GENERIC: InsertResult = { ok: false, message: messages.GENERIC_ERROR };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Una sola línea con forma de imagen que apunta a la URL que devolvió el servidor. */
function isImageLine(markdown: unknown, url: unknown): markdown is string {
  return typeof markdown === "string" && typeof url === "string" && markdown.startsWith("![") && markdown.endsWith(`](${url})`) && !/[\r\n]/.test(markdown);
}

function fromServer(result: unknown): InsertResult {
  if (!isRecord(result)) return GENERIC;
  if (result.ok === true) return isImageLine(result.markdown, result.url) ? { ok: true, markdown: result.markdown } : GENERIC;
  if (result.ok !== false || typeof result.message !== "string") return GENERIC;
  const errors = isRecord(result.fieldErrors) ? result.fieldErrors : {};
  const fieldErrors: InsertFieldErrors = {
    ...(typeof errors.image === "string" ? { image: errors.image } : {}),
    ...(typeof errors.alt === "string" ? { alt: errors.alt } : {}),
  };
  return { ok: false, message: result.message, ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}) };
}

export async function insertImage({ upload, image, alt }: Params): Promise<InsertResult> {
  const text = alt.trim();
  const fieldErrors: InsertFieldErrors = {
    ...(image === null ? { image: messages.IMAGE_FILE_REQUIRED } : image.size > MAX_IMAGE_BYTES ? { image: messages.COVER_TOO_LARGE } : {}),
    ...(text === "" ? { alt: messages.IMAGE_ALT_REQUIRED } : {}),
  };
  if (image === null || text === "" || fieldErrors.image) return { ok: false, message: messages.VALIDATION_SUMMARY, fieldErrors };

  const data = new FormData();
  data.append("image", image);
  data.append("alt", text);
  try {
    return fromServer(await upload(data));
  } catch {
    return GENERIC; // nada de lo que lance la red o el servidor llega a la pantalla
  }
}
