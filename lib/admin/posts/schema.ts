import { z } from "zod";
import * as messages from "@/lib/admin/messages";
import type { Parsed } from "@/lib/admin/result";
import { isValidSlug } from "@/lib/posts/slug";

export const POST_LIMITS = { title: 200, slug: 80, content: 50_000, categories: 10, coverAlt: 200 } as const;

export type PostFieldErrors = { title?: string; slug?: string; content?: string; categoryIds?: string; intent?: string; id?: string; cover?: string; coverAlt?: string; form?: string };
export type PostIntent = "save" | "publish" | "unpublish";
export type PostInput = {
  id?: string;
  title: string;
  slug: string;
  content: string;
  categoryIds: string[];
  intent: PostIntent;
  /** Archivo de portada (solo si se eligió uno). */
  cover?: File;
  /** Texto alternativo de la portada (solo si se escribió). */
  coverAlt?: string;
  /** Quitar la portada actual (solo al editar). */
  removeCover?: true;
};

const FIELD_MESSAGES: Record<string, (code: string) => string> = {
  title: (code) => (code === "too_big" ? messages.TITLE_TOO_LONG : messages.TITLE_REQUIRED),
  slug: () => messages.SLUG_INVALID,
  content: () => messages.CONTENT_TOO_LONG,
  categoryIds: () => messages.CATEGORIES_INVALID,
  intent: () => messages.INTENT_INVALID,
  id: () => messages.INVALID_REQUEST,
  cover: () => messages.COVER_CORRUPT,
  coverAlt: (code) => (code === "too_big" ? messages.COVER_ALT_TOO_LONG : messages.COVER_ALT_REQUIRED),
};

/** Las reglas entre campos (portada y alt) se señalan con un código propio que aquí se traduce al mensaje. */
const CROSS_FIELD: Record<string, string> = {
  COVER_ALT_REQUIRED: messages.COVER_ALT_REQUIRED,
  COVER_ALT_WITHOUT_COVER: messages.COVER_ALT_WITHOUT_COVER,
  COVER_CONFLICT: messages.COVER_CONFLICT,
};

/** Convierte los fallos de Zod en un mensaje fijo por campo. Nunca se copia el texto de Zod. */
export function toFieldErrors(error: z.ZodError): PostFieldErrors {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = typeof issue.path[0] === "string" ? issue.path[0] : "";
    const describe = Object.hasOwn(FIELD_MESSAGES, field) ? FIELD_MESSAGES[field] : null; // eslint-disable-line security/detect-object-injection
    const crossField = issue.code === "custom" && Object.hasOwn(CROSS_FIELD, issue.message) ? CROSS_FIELD[issue.message] : null;
    if (issue.code === "unrecognized_keys" || !describe) errors.form ??= messages.INVALID_REQUEST;
    else errors[field] ??= crossField ?? describe(issue.code); // eslint-disable-line security/detect-object-injection
  }
  return errors;
}

const fields = (intents: readonly [string, ...string[]]) => ({
  title: z.string().trim().min(1).max(POST_LIMITS.title),
  slug: z
    .string()
    .trim()
    .default("")
    .refine((value) => value === "" || isValidSlug(value)),
  content: z.string().max(POST_LIMITS.content).default(""),
  categoryIds: z
    .array(z.uuid())
    .max(POST_LIMITS.categories)
    .default([])
    .refine((ids) => new Set(ids).size === ids.length),
  intent: z.enum(intents),
  // Un campo de archivo sin selección llega como un archivo de 0 bytes y SIN nombre (en Next, con `name` indefinido; en un
  // navegador, vacío): equivale a no enviar nada. Un archivo vacío con nombre sí se rechaza más adelante como «vacío».
  cover: z.preprocess((value) => (value instanceof File && value.size === 0 && !value.name ? undefined : value), z.instanceof(File).optional()),
  coverAlt: z
    .string()
    .trim()
    .max(POST_LIMITS.coverAlt)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

type Mode = "create" | "update";

/** Reglas entre campos: el alt es obligatorio con un archivo, no hay alt sin portada al crear y no se sube y se quita a la vez. */
function crossFieldRules(mode: Mode) {
  return (data: { cover?: File; coverAlt?: string; removeCover?: "on" }, ctx: z.RefinementCtx) => {
    const add = (path: string, message: string) => ctx.addIssue({ code: "custom", message, path: [path] });
    if (data.cover && data.removeCover) add("cover", "COVER_CONFLICT");
    if (data.cover && !data.coverAlt) add("coverAlt", "COVER_ALT_REQUIRED");
    if (mode === "create" && !data.cover && data.coverAlt) add("coverAlt", "COVER_ALT_WITHOUT_COVER");
  };
}

const CREATE = z.strictObject(fields(["save", "publish"])).superRefine(crossFieldRules("create"));
const UPDATE = z
  .strictObject({ id: z.uuid(), ...fields(["save", "publish", "unpublish"]), removeCover: z.literal("on").optional() })
  .superRefine(crossFieldRules("update"))
  .transform(({ removeCover, ...rest }) => ({ ...rest, ...(removeCover ? { removeCover: true as const } : {}) }));
const ID_ONLY = z.strictObject({ id: z.uuid() });
const DELETE = z.strictObject({ id: z.uuid(), confirm: z.literal("eliminar") });

function run<T>(schema: z.ZodType<T>, input: unknown): Parsed<T, PostFieldErrors> {
  const parsed = schema.safeParse(input);
  return parsed.success ? { success: true, data: parsed.data } : { success: false, errors: toFieldErrors(parsed.error) };
}

export function parsePostForm(input: unknown, mode: Mode): Parsed<PostInput, PostFieldErrors> {
  return run(mode === "create" ? CREATE : UPDATE, input) as Parsed<PostInput, PostFieldErrors>;
}

export const parsePostIdForm = (input: unknown) => run(ID_ONLY, input);
export const parsePostDeleteForm = (input: unknown) => run(DELETE, input);
