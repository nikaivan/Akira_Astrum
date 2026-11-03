import type { SupabaseClient } from "@supabase/supabase-js";
import * as messages from "@/lib/admin/messages";
import { isValidSlug, slugify, uniqueSlug } from "@/lib/posts/slug";
import { publish, unpublish, type PostState } from "@/lib/posts/status";
import { parsePostDeleteForm, parsePostForm, parsePostIdForm, type PostFieldErrors, type PostInput } from "./schema";

export type PostResult =
  | { ok: true; id: string; slug: string; message: string }
  | { ok: false; message: string; fieldErrors?: PostFieldErrors };

type Context = { supabase: SupabaseClient; userId: string; input: unknown; now: Date };
type PostRow = { id: string; slug: string; status: string; published_at: string | null };

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

const fail = (message: string, fieldErrors?: PostFieldErrors): PostResult => ({ ok: false, message, ...(fieldErrors ? { fieldErrors } : {}) });
const invalid = (errors: PostFieldErrors): PostResult => fail(errors.form ? messages.INVALID_REQUEST : messages.VALIDATION_SUMMARY, errors);

/** Cualquier excepción o fallo inesperado falla cerrado con un mensaje genérico (A10): nada interno sale al cliente. */
async function guarded(run: () => Promise<PostResult>): Promise<PostResult> {
  try {
    return await run();
  } catch {
    return fail(messages.GENERIC_ERROR);
  }
}

const stateOf = (row: PostRow): PostState => ({
  status: row.status as PostState["status"],
  publishedAt: row.published_at === null ? null : new Date(row.published_at),
});

async function missingCategories(supabase: SupabaseClient, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return false;
  const { data, error } = await supabase.from("categories").select("id").in("id", ids);
  if (error) throw new Error("lectura");
  return (data ?? []).length !== ids.length;
}

async function loadPost(supabase: SupabaseClient, id: string): Promise<PostRow | null> {
  const { data, error } = await supabase.from("posts").select("id, slug, status, published_at").eq("id", id).maybeSingle();
  if (error) throw new Error("lectura");
  return (data as PostRow | null) ?? null;
}

async function freeSlug(supabase: SupabaseClient, title: string): Promise<string | null> {
  let base: string;
  try {
    base = slugify(title);
  } catch {
    return null;
  }
  const { data, error } = await supabase.from("posts").select("slug").like("slug", `${base}%`);
  if (error) throw new Error("lectura");
  return uniqueSlug(base, (data ?? []).map((row) => String((row as { slug: unknown }).slug)));
}

export function performCreatePost({ supabase, userId, input, now }: Context): Promise<PostResult> {
  return guarded(async () => {
    const parsed = parsePostForm(input, "create");
    if (!parsed.success) return invalid(parsed.errors);
    const data = parsed.data;

    if (await missingCategories(supabase, data.categoryIds)) return fail(messages.VALIDATION_SUMMARY, { categoryIds: messages.CATEGORY_MISSING });

    let slug = data.slug;
    if (slug === "") {
      const generated = await freeSlug(supabase, data.title);
      if (generated === null) return fail(messages.VALIDATION_SUMMARY, { slug: messages.SLUG_FROM_TITLE_FAILED });
      slug = generated;
    }

    const state = data.intent === "publish" ? publish({ status: "draft", publishedAt: null }, now) : ({ status: "draft", publishedAt: null } as PostState);
    const { data: created, error } = await supabase
      .from("posts")
      .insert({ title: data.title, slug, content_md: data.content, status: state.status, published_at: state.publishedAt?.toISOString() ?? null, author_id: userId })
      .select("id")
      .single();
    if (error || !created) return error?.code === UNIQUE_VIOLATION ? fail(messages.VALIDATION_SUMMARY, { slug: messages.SLUG_TAKEN }) : fail(messages.GENERIC_ERROR);
    const id = String((created as { id: unknown }).id);

    if (data.categoryIds.length > 0) {
      const { error: linkError } = await supabase.from("post_categories").insert(data.categoryIds.map((categoryId) => ({ post_id: id, category_id: categoryId })));
      if (linkError) {
        // Un guardado a medias no se queda: se retira la entrada recién creada. Si la limpieza falla, igualmente error genérico.
        try {
          await supabase.from("posts").delete().eq("id", id);
        } catch {
          // sin efecto: el resultado ya es un fallo
        }
        return linkError.code === FOREIGN_KEY_VIOLATION ? fail(messages.VALIDATION_SUMMARY, { categoryIds: messages.CATEGORY_MISSING }) : fail(messages.GENERIC_ERROR);
      }
    }
    return { ok: true, id, slug, message: messages.POST_CREATED };
  });
}

async function replaceCategories(supabase: SupabaseClient, postId: string, wanted: string[]): Promise<PostResult | null> {
  const { data, error } = await supabase.from("post_categories").select("category_id").eq("post_id", postId);
  if (error) return fail(messages.GENERIC_ERROR);
  const current = (data ?? []).map((row) => String((row as { category_id: unknown }).category_id));
  const toAdd = wanted.filter((id) => !current.includes(id));
  const toRemove = current.filter((id) => !wanted.includes(id));

  // Primero se añaden las nuevas y después se quitan las sobrantes: un fallo nunca deja la entrada sin categorías.
  if (toAdd.length > 0) {
    const { error: addError } = await supabase.from("post_categories").insert(toAdd.map((categoryId) => ({ post_id: postId, category_id: categoryId })));
    if (addError) return addError.code === FOREIGN_KEY_VIOLATION ? fail(messages.VALIDATION_SUMMARY, { categoryIds: messages.CATEGORY_MISSING }) : fail(messages.GENERIC_ERROR);
  }
  if (toRemove.length > 0) {
    const { error: removeError } = await supabase.from("post_categories").delete().eq("post_id", postId).in("category_id", toRemove);
    if (removeError) return fail(messages.GENERIC_ERROR);
  }
  return null;
}

const alreadyIn = (intent: PostInput["intent"]) => (intent === "publish" ? messages.ALREADY_PUBLISHED : intent === "unpublish" ? messages.ALREADY_DRAFT : messages.POST_CHANGED);
const savedMessage = (intent: PostInput["intent"]) => (intent === "publish" ? messages.POST_PUBLISHED : intent === "unpublish" ? messages.POST_UNPUBLISHED : messages.POST_SAVED);

export function performUpdatePost({ supabase, input, now }: Context): Promise<PostResult> {
  return guarded(async () => {
    const parsed = parsePostForm(input, "update");
    if (!parsed.success) return invalid(parsed.errors);
    const data = parsed.data as PostInput & { id: string };

    const current = await loadPost(supabase, data.id);
    if (!current) return fail(messages.POST_NOT_FOUND);

    if (data.intent === "publish" && current.status === "published") return fail(messages.ALREADY_PUBLISHED);
    if (data.intent === "unpublish" && current.status === "draft") return fail(messages.ALREADY_DRAFT);

    const slug = data.slug === "" ? current.slug : data.slug;
    if (!isValidSlug(slug)) return fail(messages.VALIDATION_SUMMARY, { slug: messages.SLUG_INVALID });
    if (slug !== current.slug && current.status === "published") return fail(messages.VALIDATION_SUMMARY, { slug: messages.SLUG_LOCKED });
    if (await missingCategories(supabase, data.categoryIds)) return fail(messages.VALIDATION_SUMMARY, { categoryIds: messages.CATEGORY_MISSING });

    const patch: Record<string, unknown> = { title: data.title, slug, content_md: data.content };
    if (data.intent !== "save") {
      const next = data.intent === "publish" ? publish(stateOf(current), now) : unpublish(stateOf(current));
      patch.status = next.status;
      patch.published_at = next.publishedAt?.toISOString() ?? null;
    }

    // Protegida por el estado leído: si otra petición lo cambió entre medias, no se pisa nada.
    const { data: updated, error } = await supabase.from("posts").update(patch).eq("id", data.id).eq("status", current.status).select("id");
    if (error) return error.code === UNIQUE_VIOLATION ? fail(messages.VALIDATION_SUMMARY, { slug: messages.SLUG_TAKEN }) : fail(messages.GENERIC_ERROR);
    if (!updated || updated.length === 0) return fail(alreadyIn(data.intent));

    const categoriesFailure = await replaceCategories(supabase, data.id, data.categoryIds);
    if (categoriesFailure) return categoriesFailure;
    return { ok: true, id: data.id, slug, message: savedMessage(data.intent) };
  });
}

async function changeStatus({ supabase, input, now }: Context, to: "published" | "draft"): Promise<PostResult> {
  const parsed = parsePostIdForm(input);
  if (!parsed.success) return invalid(parsed.errors);
  const { id } = parsed.data;

  const current = await loadPost(supabase, id);
  if (!current) return fail(messages.POST_NOT_FOUND);
  const already = to === "published" ? messages.ALREADY_PUBLISHED : messages.ALREADY_DRAFT;
  if (current.status === to) return fail(already);

  // La lógica de estados (ADR 0006) valida la coherencia: un estado raro lanza y falla cerrado.
  const next = to === "published" ? publish(stateOf(current), now) : unpublish(stateOf(current));
  const { data, error } = await supabase
    .from("posts")
    .update({ status: next.status, published_at: next.publishedAt?.toISOString() ?? null })
    .eq("id", id)
    .eq("status", current.status)
    .select("id");
  if (error) return fail(messages.GENERIC_ERROR);
  if (!data || data.length === 0) return fail(already);
  return { ok: true, id, slug: current.slug, message: to === "published" ? messages.POST_PUBLISHED : messages.POST_UNPUBLISHED };
}

export const performPublishPost = (context: Context) => guarded(() => changeStatus(context, "published"));
export const performUnpublishPost = (context: Context) => guarded(() => changeStatus(context, "draft"));

export function performDeletePost({ supabase, input }: Context): Promise<PostResult> {
  return guarded(async () => {
    const parsed = parsePostDeleteForm(input);
    if (!parsed.success) return invalid(parsed.errors);
    const { id } = parsed.data;

    const { data, error } = await supabase.from("posts").delete().eq("id", id).select("id, slug");
    if (error) return fail(messages.GENERIC_ERROR);
    if (!data || data.length === 0) return fail(messages.POST_NOT_FOUND);
    return { ok: true, id, slug: String((data[0] as { slug: unknown }).slug), message: messages.POST_DELETED };
  });
}
