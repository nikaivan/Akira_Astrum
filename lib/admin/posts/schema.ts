import { z } from "zod";
import * as messages from "@/lib/admin/messages";
import type { Parsed } from "@/lib/admin/result";
import { isValidSlug } from "@/lib/posts/slug";

export const POST_LIMITS = { title: 200, slug: 80, content: 50_000, categories: 10 } as const;

export type PostFieldErrors = { title?: string; slug?: string; content?: string; categoryIds?: string; intent?: string; id?: string; form?: string };
export type PostIntent = "save" | "publish" | "unpublish";
export type PostInput = { id?: string; title: string; slug: string; content: string; categoryIds: string[]; intent: PostIntent };

const FIELD_MESSAGES: Record<string, (code: string) => string> = {
  title: (code) => (code === "too_big" ? messages.TITLE_TOO_LONG : messages.TITLE_REQUIRED),
  slug: () => messages.SLUG_INVALID,
  content: () => messages.CONTENT_TOO_LONG,
  categoryIds: () => messages.CATEGORIES_INVALID,
  intent: () => messages.INTENT_INVALID,
  id: () => messages.INVALID_REQUEST,
};

/** Convierte los fallos de Zod en un mensaje fijo por campo. Nunca se copia el texto de Zod. */
export function toFieldErrors(error: z.ZodError): PostFieldErrors {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = typeof issue.path[0] === "string" ? issue.path[0] : "";
    const describe = Object.hasOwn(FIELD_MESSAGES, field) ? FIELD_MESSAGES[field] : null; // eslint-disable-line security/detect-object-injection
    if (issue.code === "unrecognized_keys" || !describe) errors.form ??= messages.INVALID_REQUEST;
    else errors[field] ??= describe(issue.code); // eslint-disable-line security/detect-object-injection
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
});

const CREATE = z.strictObject(fields(["save", "publish"]));
const UPDATE = z.strictObject({ id: z.uuid(), ...fields(["save", "publish", "unpublish"]) });
const ID_ONLY = z.strictObject({ id: z.uuid() });
const DELETE = z.strictObject({ id: z.uuid(), confirm: z.literal("eliminar") });

function run<T>(schema: z.ZodType<T>, input: unknown): Parsed<T, PostFieldErrors> {
  const parsed = schema.safeParse(input);
  return parsed.success ? { success: true, data: parsed.data } : { success: false, errors: toFieldErrors(parsed.error) };
}

export function parsePostForm(input: unknown, mode: "create" | "update"): Parsed<PostInput, PostFieldErrors> {
  return run(mode === "create" ? CREATE : UPDATE, input) as Parsed<PostInput, PostFieldErrors>;
}

export const parsePostIdForm = (input: unknown) => run(ID_ONLY, input);
export const parsePostDeleteForm = (input: unknown) => run(DELETE, input);
