import type { SupabaseClient } from "@supabase/supabase-js";
import * as messages from "@/lib/admin/messages";
import { slugify, uniqueSlug } from "@/lib/posts/slug";
import { parseCategoryDeleteForm, parseCategoryForm, type CategoryFieldErrors } from "./schema";

export type CategoryResult =
  | { ok: true; id: string; slug?: string; message: string; removedFromPosts?: number }
  | { ok: false; message: string; fieldErrors?: CategoryFieldErrors };

type Context = { supabase: SupabaseClient; userId: string; input: unknown };

const UNIQUE_VIOLATION = "23505";

const fail = (message: string, fieldErrors?: CategoryFieldErrors): CategoryResult => ({ ok: false, message, ...(fieldErrors ? { fieldErrors } : {}) });
const invalid = (errors: CategoryFieldErrors): CategoryResult => fail(errors.form ? messages.INVALID_REQUEST : messages.VALIDATION_SUMMARY, errors);

async function guarded(run: () => Promise<CategoryResult>): Promise<CategoryResult> {
  try {
    return await run();
  } catch {
    return fail(messages.GENERIC_ERROR);
  }
}

export function performCreateCategory({ supabase, input }: Context): Promise<CategoryResult> {
  return guarded(async () => {
    const parsed = parseCategoryForm(input, "create");
    if (!parsed.success) return invalid(parsed.errors);
    const { name } = parsed.data;

    let base: string;
    try {
      base = slugify(name);
    } catch {
      return fail(messages.VALIDATION_SUMMARY, { name: messages.CATEGORY_NAME_UNUSABLE });
    }
    const { data: taken, error: readError } = await supabase.from("categories").select("slug").like("slug", `${base}%`);
    if (readError) return fail(messages.GENERIC_ERROR);
    const slug = uniqueSlug(base, (taken ?? []).map((row) => String((row as { slug: unknown }).slug)));

    const { data, error } = await supabase.from("categories").insert({ name, slug }).select("id").single();
    if (error || !data) return error?.code === UNIQUE_VIOLATION ? fail(messages.VALIDATION_SUMMARY, { name: messages.CATEGORY_SLUG_TAKEN }) : fail(messages.GENERIC_ERROR);
    return { ok: true, id: String((data as { id: unknown }).id), slug, message: messages.CATEGORY_CREATED };
  });
}

export function performRenameCategory({ supabase, input }: Context): Promise<CategoryResult> {
  return guarded(async () => {
    const parsed = parseCategoryForm(input, "rename");
    if (!parsed.success) return invalid(parsed.errors);
    const { id, name } = parsed.data as { id: string; name: string };

    // Solo cambia el nombre: el slug se mantiene para no romper /categorias/<slug>.
    const { data, error } = await supabase.from("categories").update({ name }).eq("id", id).select("id, slug");
    if (error) return fail(messages.GENERIC_ERROR);
    if (!data || data.length === 0) return fail(messages.CATEGORY_NOT_FOUND);
    return { ok: true, id, slug: String((data[0] as { slug: unknown }).slug), message: messages.CATEGORY_RENAMED };
  });
}

export function performDeleteCategory({ supabase, input }: Context): Promise<CategoryResult> {
  return guarded(async () => {
    const parsed = parseCategoryDeleteForm(input);
    if (!parsed.success) return invalid(parsed.errors);
    const { id } = parsed.data;

    const { data: links, error: countError } = await supabase.from("post_categories").select("post_id").eq("category_id", id);
    if (countError) return fail(messages.GENERIC_ERROR);

    // La base de datos solo borra las filas de unión (ON DELETE CASCADE): las entradas se conservan.
    const { data, error } = await supabase.from("categories").delete().eq("id", id).select("id");
    if (error) return fail(messages.GENERIC_ERROR);
    if (!data || data.length === 0) return fail(messages.CATEGORY_NOT_FOUND);
    return { ok: true, id, message: messages.CATEGORY_DELETED, removedFromPosts: (links ?? []).length };
  });
}
