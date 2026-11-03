import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidSlug } from "@/lib/posts/slug";
import { coverImageUrl } from "./cover";
import { formatPublishedDate } from "./dates";
import { excerptOf } from "./excerpt";
import { readingMinutes } from "./reading-time";

export type CategoryRef = { name: string; slug: string };

export type PostCardData = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  categories: CategoryRef[];
  publishedAt: string;
  dateLabel: string;
  readingMinutes: number;
};

export type PostDetail = PostCardData & { content: string; description: string };

export type Result<T> = { status: "ok"; data: T } | { status: "not-found" } | { status: "error" };

type Options = { origin: string | null | undefined };

const MAX_LIMIT = 50;
// Columnas explícitas: nunca *, ni el autor, ni el estado.
const COLUMNS = "id, slug, title, cover_image_path, published_at, content_md, post_categories(categories(name, slug))";

const clampLimit = (limit: number) => (Number.isFinite(limit) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit))) : MAX_LIMIT);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("Dato no válido");
  return value;
};

function categoriesOf(row: Record<string, unknown>): CategoryRef[] {
  const links = Array.isArray(row.post_categories) ? row.post_categories : [];
  return links.flatMap((link) => {
    const nested = isObject(link) ? link.categories : null;
    const items = Array.isArray(nested) ? nested : [nested];
    return items.filter(isObject).map((category) => ({ name: text(category.name), slug: text(category.slug) }));
  });
}

function parseRow(row: unknown, origin: Options["origin"]): { card: PostCardData; content: string } {
  if (!isObject(row)) throw new Error("Fila no válida");
  const content = text(row.content_md);
  const publishedAt = text(row.published_at);
  const card: PostCardData = {
    id: text(row.id),
    slug: text(row.slug),
    title: text(row.title),
    coverUrl: coverImageUrl(origin, typeof row.cover_image_path === "string" ? row.cover_image_path : null),
    categories: categoriesOf(row),
    publishedAt,
    dateLabel: formatPublishedDate(publishedAt),
    readingMinutes: readingMinutes(content),
  };
  return { card, content };
}

const toCard = (row: unknown, origin: Options["origin"]): PostCardData => parseRow(row, origin).card;

function toDetail(row: unknown, origin: Options["origin"]): PostDetail {
  const { card, content } = parseRow(row, origin);
  return { ...card, content, description: excerptOf(content) };
}

/** Entradas publicadas, de la más nueva a la más antigua. RLS ya filtra; el filtro explícito es una segunda barrera. */
export async function listPublishedPosts(
  client: SupabaseClient,
  { limit, origin }: Options & { limit: number },
): Promise<Result<PostCardData[]>> {
  try {
    const { data, error } = await client
      .from("posts")
      .select(COLUMNS)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(clampLimit(limit));
    if (error || !Array.isArray(data)) return { status: "error" };
    return { status: "ok", data: data.map((row) => toCard(row, origin)) };
  } catch {
    return { status: "error" };
  }
}

/** Una entrada publicada por slug. Borrador, despublicada e inexistente son el mismo `not-found`. */
export async function getPublishedPost(client: SupabaseClient, slug: string, { origin }: Options): Promise<Result<PostDetail>> {
  if (!isValidSlug(slug)) return { status: "not-found" };
  try {
    const { data, error } = await client
      .from("posts")
      .select(COLUMNS)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) return { status: "error" };
    if (!data) return { status: "not-found" };
    return { status: "ok", data: toDetail(data, origin) };
  } catch {
    return { status: "error" };
  }
}

/** Una categoría y sus entradas publicadas. Categoría inexistente: `not-found`; sin entradas visibles: lista vacía. */
export async function getCategoryWithPosts(
  client: SupabaseClient,
  slug: string,
  { limit, origin }: Options & { limit: number },
): Promise<Result<{ category: CategoryRef; posts: PostCardData[] }>> {
  if (!isValidSlug(slug)) return { status: "not-found" };
  try {
    const found = await client.from("categories").select("id, name, slug").eq("slug", slug).maybeSingle();
    if (found.error) return { status: "error" };
    if (!found.data) return { status: "not-found" };
    const category = { name: text(found.data.name), slug: text(found.data.slug) };

    const links = await client.from("post_categories").select("post_id").eq("category_id", found.data.id);
    if (links.error || !Array.isArray(links.data)) return { status: "error" };
    const ids = links.data.map((link) => text(link.post_id));
    if (ids.length === 0) return { status: "ok", data: { category, posts: [] } };

    const posts = await client
      .from("posts")
      .select(COLUMNS)
      .in("id", ids)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(clampLimit(limit));
    if (posts.error || !Array.isArray(posts.data)) return { status: "error" };
    return { status: "ok", data: { category, posts: posts.data.map((row) => toCard(row, origin)) } };
  } catch {
    return { status: "error" };
  }
}
