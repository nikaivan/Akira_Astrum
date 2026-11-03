import type { SupabaseClient } from "@supabase/supabase-js";
import * as messages from "@/lib/admin/messages";
import { fail, guarded, invalid, PG_FOREIGN_KEY_VIOLATION, PG_UNIQUE_VIOLATION, type Failure } from "@/lib/admin/result";
import type { RateLimiter } from "@/lib/auth/rate-limit";
import { removeCoverFile, uploadCover } from "@/lib/storage/covers";
import { MAX_IMAGE_BYTES, validateImage, type ImageFailure, type ValidImage } from "@/lib/storage/image-validation";
import { isValidSlug, slugify, uniqueSlug } from "@/lib/posts/slug";
import { publish, unpublish, type PostState } from "@/lib/posts/status";
import { parsePostDeleteForm, parsePostForm, parsePostIdForm, type PostFieldErrors, type PostInput } from "./schema";

export type PostResult = { ok: true; id: string; slug: string; message: string; warning?: string } | Failure<PostFieldErrors>;

type Context = { supabase: SupabaseClient; userId: string; input: unknown; now: Date; limiter?: RateLimiter };
type PostRow = { id: string; slug: string; status: string; published_at: string | null; cover_image_path: string | null; cover_alt: string | null };

const COVER_ERRORS: Record<ImageFailure, string> = {
  empty: messages.COVER_EMPTY,
  "too-large": messages.COVER_TOO_LARGE,
  unsupported: messages.COVER_INVALID_TYPE,
  corrupt: messages.COVER_CORRUPT,
  dimensions: messages.COVER_DIMENSIONS,
};

type Inspected = { ok: true; bytes: Uint8Array; image: ValidImage } | Failure<PostFieldErrors>;

/** Frena el abuso (cada intento cuenta, también los rechazados) y valida el archivo por su contenido antes de tocar Storage. */
async function inspectCover(file: File, userId: string, limiter?: RateLimiter): Promise<Inspected> {
  if (limiter) {
    if (limiter.isBlocked(userId)) return fail(messages.UPLOAD_RATE_LIMIT);
    limiter.recordFailure(userId);
  }
  // Un archivo que ya pesa de más no se lee entero.
  if (file.size > MAX_IMAGE_BYTES) return fail(messages.VALIDATION_SUMMARY, { cover: messages.COVER_TOO_LARGE });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateImage(bytes);
  return check.ok ? { ok: true, bytes, image: check } : fail(messages.VALIDATION_SUMMARY, { cover: COVER_ERRORS[check.reason] });
}

/** Retira un archivo recién subido cuando lo que venía después ha fallado. Si esto también falla, no hay nada más que hacer. */
const discard = (supabase: SupabaseClient, path: string | null) => removeCoverFile(supabase, path);

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
  const { data, error } = await supabase.from("posts").select("id, slug, status, published_at, cover_image_path, cover_alt").eq("id", id).maybeSingle();
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

export function performCreatePost({ supabase, userId, input, now, limiter }: Context): Promise<PostResult> {
  return guarded(async () => {
    const parsed = parsePostForm(input, "create");
    if (!parsed.success) return invalid(parsed.errors);
    const data = parsed.data;

    let cover: Extract<Inspected, { ok: true }> | null = null;
    if (data.cover) {
      const inspected = await inspectCover(data.cover, userId, limiter);
      if (!inspected.ok) return inspected;
      cover = inspected;
    }

    if (await missingCategories(supabase, data.categoryIds)) return fail(messages.VALIDATION_SUMMARY, { categoryIds: messages.CATEGORY_MISSING });

    let slug = data.slug;
    if (slug === "") {
      const generated = await freeSlug(supabase, data.title);
      if (generated === null) return fail(messages.VALIDATION_SUMMARY, { slug: messages.SLUG_FROM_TITLE_FAILED });
      slug = generated;
    }

    // Subida y escritura van juntas: si algo falla después de subir, el archivo se retira y no queda ruta rota ni archivo huérfano.
    let coverPath: string | null = null;
    if (cover) {
      const uploaded = await uploadCover(supabase, cover.bytes, cover.image);
      if (!uploaded.ok) return fail(messages.GENERIC_ERROR);
      coverPath = uploaded.path;
    }

    const state = data.intent === "publish" ? publish({ status: "draft", publishedAt: null }, now) : ({ status: "draft", publishedAt: null } as PostState);
    const { data: created, error } = await supabase
      .from("posts")
      .insert({
        title: data.title,
        slug,
        content_md: data.content,
        status: state.status,
        published_at: state.publishedAt?.toISOString() ?? null,
        author_id: userId,
        ...(coverPath ? { cover_image_path: coverPath, cover_alt: data.coverAlt } : {}),
      })
      .select("id")
      .single();
    if (error || !created) {
      await discard(supabase, coverPath);
      return error?.code === PG_UNIQUE_VIOLATION ? fail(messages.VALIDATION_SUMMARY, { slug: messages.SLUG_TAKEN }) : fail(messages.GENERIC_ERROR);
    }
    const id = String((created as { id: unknown }).id);

    if (data.categoryIds.length > 0) {
      const { error: linkError } = await supabase.from("post_categories").insert(data.categoryIds.map((categoryId) => ({ post_id: id, category_id: categoryId })));
      if (linkError) {
        // Un guardado a medias no se queda: se retira la entrada recién creada y su portada. Si la limpieza falla, igualmente error genérico.
        try {
          await supabase.from("posts").delete().eq("id", id);
        } catch {
          // sin efecto: el resultado ya es un fallo
        }
        await discard(supabase, coverPath);
        return linkError.code === PG_FOREIGN_KEY_VIOLATION ? fail(messages.VALIDATION_SUMMARY, { categoryIds: messages.CATEGORY_MISSING }) : fail(messages.GENERIC_ERROR);
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
    if (addError) return addError.code === PG_FOREIGN_KEY_VIOLATION ? fail(messages.VALIDATION_SUMMARY, { categoryIds: messages.CATEGORY_MISSING }) : fail(messages.GENERIC_ERROR);
  }
  if (toRemove.length > 0) {
    const { error: removeError } = await supabase.from("post_categories").delete().eq("post_id", postId).in("category_id", toRemove);
    if (removeError) return fail(messages.GENERIC_ERROR);
  }
  return null;
}

const alreadyIn = (intent: PostInput["intent"]) => (intent === "publish" ? messages.ALREADY_PUBLISHED : intent === "unpublish" ? messages.ALREADY_DRAFT : messages.POST_CHANGED);
const savedMessage = (intent: PostInput["intent"]) => (intent === "publish" ? messages.POST_PUBLISHED : intent === "unpublish" ? messages.POST_UNPUBLISHED : messages.POST_SAVED);

type CoverPlan =
  | { failure: Failure<PostFieldErrors> }
  | { upload: Extract<Inspected, { ok: true }> | null; patch: Record<string, unknown>; remove: string | null };

/** Qué hacer con la portada al editar: quitar, reemplazar, cambiar solo el texto alternativo o nada. Valida antes de tocar nada. */
async function planCover(current: PostRow, data: PostInput, userId: string, limiter?: RateLimiter): Promise<CoverPlan> {
  if (data.removeCover) {
    return current.cover_image_path ? { upload: null, patch: { cover_image_path: null, cover_alt: null }, remove: current.cover_image_path } : { upload: null, patch: {}, remove: null };
  }
  if (data.cover) {
    const inspected = await inspectCover(data.cover, userId, limiter);
    if (!inspected.ok) return { failure: inspected };
    return { upload: inspected, patch: {}, remove: current.cover_image_path };
  }
  if (current.cover_image_path) {
    if (!data.coverAlt) return { failure: fail(messages.VALIDATION_SUMMARY, { coverAlt: messages.COVER_ALT_REQUIRED }) };
    return { upload: null, patch: data.coverAlt === current.cover_alt ? {} : { cover_alt: data.coverAlt }, remove: null };
  }
  if (data.coverAlt) return { failure: fail(messages.VALIDATION_SUMMARY, { coverAlt: messages.COVER_ALT_WITHOUT_COVER }) };
  return { upload: null, patch: {}, remove: null };
}

export function performUpdatePost({ supabase, userId, input, now, limiter }: Context): Promise<PostResult> {
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

    const cover = await planCover(current, data, userId, limiter);
    if ("failure" in cover) return cover.failure;

    const patch: Record<string, unknown> = { title: data.title, slug, content_md: data.content, ...cover.patch };
    if (data.intent !== "save") {
      const next = data.intent === "publish" ? publish(stateOf(current), now) : unpublish(stateOf(current));
      patch.status = next.status;
      patch.published_at = next.publishedAt?.toISOString() ?? null;
    }

    // La imagen nueva se sube antes de escribir la entrada y la antigua se borra después: si algo falla en medio, la antigua sigue ahí.
    let newPath: string | null = null;
    if (cover.upload) {
      const uploaded = await uploadCover(supabase, cover.upload.bytes, cover.upload.image);
      if (!uploaded.ok) return fail(messages.GENERIC_ERROR);
      newPath = uploaded.path;
      patch.cover_image_path = newPath;
      patch.cover_alt = data.coverAlt;
    }

    // Protegida por el estado leído: si otra petición lo cambió entre medias, no se pisa nada.
    const { data: updated, error } = await supabase.from("posts").update(patch).eq("id", data.id).eq("status", current.status).select("id");
    if (error || !updated || updated.length === 0) {
      await discard(supabase, newPath);
      if (error) return error.code === PG_UNIQUE_VIOLATION ? fail(messages.VALIDATION_SUMMARY, { slug: messages.SLUG_TAKEN }) : fail(messages.GENERIC_ERROR);
      return fail(alreadyIn(data.intent));
    }

    const warning = cover.remove !== null && !(await removeCoverFile(supabase, cover.remove)) ? messages.COVER_OLD_NOT_REMOVED : undefined;

    const categoriesFailure = await replaceCategories(supabase, data.id, data.categoryIds);
    if (categoriesFailure) return categoriesFailure;
    return { ok: true, id: data.id, slug, message: savedMessage(data.intent), ...(warning ? { warning } : {}) };
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

    // Primero la fila y después su portada: nunca queda una ruta rota; el peor caso es un archivo que no se pudo borrar y se avisa.
    const { data, error } = await supabase.from("posts").delete().eq("id", id).select("id, slug, cover_image_path");
    if (error) return fail(messages.GENERIC_ERROR);
    if (!data || data.length === 0) return fail(messages.POST_NOT_FOUND);
    const row = data[0] as { slug: unknown; cover_image_path: unknown };
    const cover = typeof row.cover_image_path === "string" ? row.cover_image_path : null;
    const warning = cover !== null && !(await removeCoverFile(supabase, cover)) ? messages.COVER_NOT_REMOVED_ON_DELETE : undefined;
    return { ok: true, id, slug: String(row.slug), message: messages.POST_DELETED, ...(warning ? { warning } : {}) };
  });
}
