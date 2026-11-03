import type { SupabaseClient } from "@supabase/supabase-js";
import { coverImageUrl } from "@/lib/blog/cover";
import type { ListFilters } from "./posts/filters";

/** Lecturas del panel: con la sesión del admin (RLS le deja ver también los borradores). Un fallo lanza y lo recoge app/error.tsx. */

export const ADMIN_LIST_LIMIT = 50;

export type AdminPostRow = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  updatedAt: string;
  publishedAt: string | null;
  categories: { name: string; slug: string }[];
};
export type AdminPostDetail = {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: "draft" | "published";
  categoryIds: string[];
  /** Portada actual (URL pública y texto alternativo), o null si no tiene. */
  cover: { url: string; alt: string } | null;
};
export type CategoryOption = { id: string; name: string; slug: string };
export type CategoryWithCount = CategoryOption & { postCount: number };

const COLUMNS = "id, title, slug, status, updated_at, published_at, post_categories(categories(name, slug))";
type RawRow = { id: string; title: string; slug: string; status: "draft" | "published"; updated_at: string; published_at: string | null; post_categories: { categories: { name: string; slug: string } | null }[] | null };

function toRow(row: RawRow): AdminPostRow {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    categories: (row.post_categories ?? []).flatMap((link) => (link.categories ? [link.categories] : [])),
  };
}

export async function listAdminPosts(supabase: SupabaseClient, filters: ListFilters): Promise<AdminPostRow[]> {
  let ids: string[] | null = null;
  if (filters.category) {
    const { data: found, error } = await supabase.from("categories").select("id").eq("slug", filters.category).maybeSingle();
    if (error) throw new Error("No se pudo cargar el listado");
    if (!found) return [];
    const { data: links, error: linkError } = await supabase.from("post_categories").select("post_id").eq("category_id", (found as { id: string }).id);
    if (linkError) throw new Error("No se pudo cargar el listado");
    ids = (links ?? []).map((link) => String((link as { post_id: unknown }).post_id));
    if (ids.length === 0) return [];
  }

  let query = supabase.from("posts").select(COLUMNS).order("updated_at", { ascending: false }).limit(ADMIN_LIST_LIMIT);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (ids) query = query.in("id", ids);
  const { data, error } = await query;
  if (error) throw new Error("No se pudo cargar el listado");
  return ((data ?? []) as unknown as RawRow[]).map(toRow);
}

export async function getAdminPost(supabase: SupabaseClient, id: string, storageOrigin?: string | null): Promise<AdminPostDetail | null> {
  const { data, error } = await supabase.from("posts").select("id, title, slug, content_md, status, cover_image_path, cover_alt, post_categories(category_id)").eq("id", id).maybeSingle();
  if (error) throw new Error("No se pudo cargar la entrada");
  if (!data) return null;
  const row = data as unknown as {
    id: string;
    title: string;
    slug: string;
    content_md: string;
    status: "draft" | "published";
    cover_image_path: string | null;
    cover_alt: string | null;
    post_categories: { category_id: string }[] | null;
  };
  const url = coverImageUrl(storageOrigin, row.cover_image_path);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content_md,
    status: row.status,
    categoryIds: (row.post_categories ?? []).map((link) => link.category_id),
    cover: url ? { url, alt: row.cover_alt ?? "" } : null,
  };
}

export async function listCategoryOptions(supabase: SupabaseClient): Promise<CategoryOption[]> {
  const { data, error } = await supabase.from("categories").select("id, name, slug").order("name");
  if (error) throw new Error("No se pudieron cargar las categorías");
  return (data ?? []) as CategoryOption[];
}

export async function listCategoriesWithCounts(supabase: SupabaseClient): Promise<CategoryWithCount[]> {
  const { data, error } = await supabase.from("categories").select("id, name, slug, post_categories(count)").order("name");
  if (error) throw new Error("No se pudieron cargar las categorías");
  return ((data ?? []) as unknown as { id: string; name: string; slug: string; post_categories: { count: number }[] | null }[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    postCount: row.post_categories?.[0]?.count ?? 0,
  }));
}
