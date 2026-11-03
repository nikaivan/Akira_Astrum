import { z } from "zod";
import * as messages from "@/lib/admin/messages";
import type { Parsed } from "@/lib/admin/posts/schema";

export const CATEGORY_LIMITS = { name: 60 } as const;

export type CategoryFieldErrors = { name?: string; id?: string; form?: string };

const CREATE = z.strictObject({ name: z.string().trim().min(1).max(CATEGORY_LIMITS.name) });
const RENAME = z.strictObject({ id: z.uuid(), name: z.string().trim().min(1).max(CATEGORY_LIMITS.name) });
const DELETE = z.strictObject({ id: z.uuid(), confirm: z.literal("eliminar") });

function errorsOf(error: z.ZodError): CategoryFieldErrors {
  const errors: CategoryFieldErrors = {};
  for (const issue of error.issues) {
    if (issue.code !== "unrecognized_keys" && issue.path[0] === "name") errors.name ??= issue.code === "too_big" ? messages.NAME_TOO_LONG : messages.NAME_REQUIRED;
    else errors.form ??= messages.INVALID_REQUEST;
  }
  return errors;
}

function run<T>(schema: z.ZodType<T>, input: unknown): Parsed<T, CategoryFieldErrors> {
  const parsed = schema.safeParse(input);
  return parsed.success ? { success: true, data: parsed.data } : { success: false, errors: errorsOf(parsed.error) };
}

export const parseCategoryForm = (input: unknown, mode: "create" | "rename") =>
  run<{ id?: string; name: string }>(mode === "create" ? CREATE : RENAME, input);
export const parseCategoryDeleteForm = (input: unknown) => run(DELETE, input);
