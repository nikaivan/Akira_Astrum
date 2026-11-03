/**
 * ÚNICO archivo de los e2e que usa SUPABASE_TEST_SERVICE_ROLE_KEY.
 * Uso permitido, solo contra el proyecto de test (ver tests/integration/README.md):
 * crear y borrar los usuarios temporales de los e2e y su perfil.
 * Nunca se usan las credenciales reales del admin. Nunca en app/, lib/ ni proxy.ts.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { assertTestEnvironment } from "../../integration/support/environment";

export type E2EUser = { id: string; email: string; password: string };

const OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } } as const;

function serviceClient() {
  const { url, serviceRoleKey } = assertTestEnvironment(process.env);
  return createClient(url, serviceRoleKey, OPTIONS);
}

/** runId empieza por "itest-": la limpieza de la suite de integración borra los restos. */
export async function createE2EUser(runId: string, label: string, role: "admin" | "user"): Promise<E2EUser> {
  const db = serviceClient();
  const email = `${runId}-${label}@example.test`;
  const password = randomBytes(18).toString("base64url");

  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);

  const profile = await db.from("profiles").insert({ id: data.user.id, display_name: label, role });
  if (profile.error) {
    await db.auth.admin.deleteUser(data.user.id);
    throw new Error(`No se pudo crear el perfil de prueba: ${profile.error.message}`);
  }
  return { id: data.user.id, email, password };
}

export async function deleteE2EUser(id: string): Promise<void> {
  await serviceClient().auth.admin.deleteUser(id);
}

// ── Datos del blog público (solo contra el proyecto de test; se borran al terminar) ──

export type E2EPost = { id: string; slug: string; title: string };
export type E2EBlog = {
  prefix: string;
  coverName: string;
  coverUrl: string;
  category: { name: string; slug: string };
  draftsOnlyCategory: { name: string; slug: string };
  /** Publicadas: `plain` es la más nueva; `rich` es más antigua, con portada y contenido hostil. */
  plain: E2EPost;
  rich: E2EPost;
  draft: E2EPost;
  unpublished: E2EPost;
  draftInDraftsOnly: E2EPost;
};

const BUCKET = "post-images";
const DAY_MS = 24 * 60 * 60 * 1000;
// PNG de 1×1 píxel (70 bytes), válido, para comprobar que next/image carga la portada.
const PIXEL_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

export const RICH_BODY = (imageUrl: string) =>
  [
    "## Sección legítima",
    "",
    "Un párrafo con **negrita** y un [enlace externo](https://example.com/pagina).",
    "",
    "<script>window.__xss = 1</script>",
    "",
    '<img src=x onerror="window.__xss = 2">',
    "",
    "[trampa](javascript:window.__xss=3)",
    "",
    '<iframe src="https://example.com/frame"></iframe>',
    "",
    "![externa](https://example.com/externa.png)",
    "",
    `![Foto del proyecto](${imageUrl})`,
  ].join("\n");

export const PLAIN_BODY = [
  `Palabra larguísima: ${"a".repeat(220)}`,
  "",
  `<https://example.com/${"x".repeat(220)}>`,
  "",
  "```js",
  `const linea = "${"y".repeat(220)}";`,
  "```",
  "",
  "Un párrafo normal con texto suficiente para comprobar el ancho de lectura de la entrada en pantallas grandes.",
].join("\n");

/** Crea categorías, entradas (publicadas, borradores y una despublicada) y una portada en Storage. */
export async function createE2EBlog(runId: string, adminId: string): Promise<E2EBlog> {
  const db = serviceClient();
  const { url } = assertTestEnvironment(process.env);
  const prefix = `${runId}-blog`;
  const coverName = `${randomUUID()}.png`;
  const coverUrl = `${url}/storage/v1/object/public/${BUCKET}/${coverName}`;
  const now = Date.now();

  const upload = await db.storage.from(BUCKET).upload(coverName, PIXEL_PNG, { contentType: "image/png" });
  if (upload.error) throw new Error(`No se pudo subir la portada de prueba: ${upload.error.message}`);

  const category = async (slug: string, name: string) => {
    const { data, error } = await db.from("categories").insert({ name, slug }).select("id").single();
    if (error || !data) throw new Error(`No se pudo crear la categoría de prueba: ${error?.message}`);
    return { id: data.id as string, name, slug };
  };
  const post = async (key: string, title: string, content: string, daysAgo: number | null, cover: string | null = null): Promise<E2EPost> => {
    const slug = `${prefix}-${key}`;
    const { data, error } = await db
      .from("posts")
      .insert({
        title,
        slug,
        content_md: content,
        cover_image_path: cover,
        author_id: adminId,
        status: daysAgo === null ? "draft" : "published",
        published_at: daysAgo === null ? null : new Date(now - daysAgo * DAY_MS).toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`No se pudo crear la entrada de prueba: ${error?.message}`);
    return { id: data.id as string, slug, title };
  };
  const link = async (postId: string, categoryId: string) => {
    const { error } = await db.from("post_categories").insert({ post_id: postId, category_id: categoryId });
    if (error) throw new Error(`No se pudo asignar la categoría de prueba: ${error.message}`);
  };

  const main = await category(`${prefix}-cat`, `Categoría E2E ${runId}`);
  const draftsOnly = await category(`${prefix}-borradores`, `Solo borradores ${runId}`);
  const plain = await post("sencilla", `Entrada sencilla ${runId}`, PLAIN_BODY, 1);
  const rich = await post("rica", `Entrada rica ${runId}`, RICH_BODY(coverUrl), 2, coverName);
  const draft = await post("borrador", `Entrada borrador ${runId}`, "Contenido secreto del borrador.", null);
  const unpublished = await post("despublicada", `Entrada despublicada ${runId}`, "Contenido que ya no es público.", 3);
  const draftInDraftsOnly = await post("borrador-2", `Entrada borrador dos ${runId}`, "Otro borrador.", null);

  await link(plain.id, main.id);
  await link(rich.id, main.id);
  await link(draft.id, main.id);
  await link(unpublished.id, main.id);
  await link(draftInDraftsOnly.id, draftsOnly.id);
  await setE2EPostPublished(unpublished.id, false); // despublicada: estuvo publicada y vuelve a borrador

  return {
    prefix,
    coverName,
    coverUrl,
    category: { name: main.name, slug: main.slug },
    draftsOnlyCategory: { name: draftsOnly.name, slug: draftsOnly.slug },
    plain,
    rich,
    draft,
    unpublished,
    draftInDraftsOnly,
  };
}

/** Publica o despublica una entrada (con el servicio, para simular al admin sin pasar por el panel). */
export async function setE2EPostPublished(id: string, published: boolean): Promise<void> {
  const { error } = await serviceClient()
    .from("posts")
    .update({ status: published ? "published" : "draft", published_at: published ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(`No se pudo cambiar el estado de la entrada de prueba: ${error.message}`);
}

/** Borra solo lo que lleva el prefijo del test y la portada subida. */
export async function deleteE2EBlog(blog: E2EBlog): Promise<void> {
  const db = serviceClient();
  await db.from("posts").delete().like("slug", `${blog.prefix}%`);
  await db.from("categories").delete().like("slug", `${blog.prefix}%`);
  await db.storage.from(BUCKET).remove([blog.coverName]);
}
