import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientFor, exists, expectDenied } from "./support/api";
import { seedContent, type Seed } from "./support/service-role";

let seed: Seed;
beforeAll(async () => {
  seed = await seedContent("admin");
});
afterAll(async () => {
  await seed?.cleanup();
});

const admin = () => clientFor("admin");
let counter = 0;
const nextSlug = (label: string) => `${seed.prefix}-${label}-${++counter}`;

async function createDraft(label: string) {
  const { data, error } = await admin()
    .from("posts")
    .insert({ title: `Entrada ${label}`, slug: nextSlug(label), author_id: seed.adminId })
    .select()
    .single();
  expect(error).toBeNull();
  if (!data) throw new Error("No se creó la entrada de prueba");
  return data as { id: string; slug: string; status: string; published_at: string | null; updated_at: string };
}

describe("entradas", () => {
  it("lista borradores y publicadas", async () => {
    const { data, error } = await admin().from("posts").select("id").in("id", [seed.published.id, seed.draft.id]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("crea un borrador con su propio author_id", async () => {
    const draft = await createDraft("nuevo");
    expect(draft.status).toBe("draft");
    expect(draft.published_at).toBeNull();
  });

  it("no crea una entrada a nombre de otro autor", async () => {
    const slug = nextSlug("ajena");
    const result = await admin().from("posts").insert({ title: "Ajena", slug, author_id: seed.userId }).select();
    expectDenied(result);
    expect(await exists("posts", "slug", slug)).toBe(false);
  });

  it("edita el título y el contenido, y updated_at avanza", async () => {
    const draft = await createDraft("edicion");
    const { data, error } = await admin()
      .from("posts")
      .update({ title: "Título editado", content_md: "# Contenido" })
      .eq("id", draft.id)
      .select("title, content_md, updated_at")
      .single();
    expect(error).toBeNull();
    expect(data?.title).toBe("Título editado");
    expect(data?.content_md).toBe("# Contenido");
    expect(new Date(data?.updated_at ?? 0).getTime()).toBeGreaterThan(new Date(draft.updated_at).getTime());
  });

  it("publica y despublica", async () => {
    const draft = await createDraft("ciclo");
    const publishedAt = new Date().toISOString();

    const published = await admin().from("posts").update({ status: "published", published_at: publishedAt }).eq("id", draft.id).select("status").single();
    expect(published.error).toBeNull();
    expect(published.data?.status).toBe("published");

    const back = await admin().from("posts").update({ status: "draft", published_at: null }).eq("id", draft.id).select("status, published_at").single();
    expect(back.error).toBeNull();
    expect(back.data).toEqual({ status: "draft", published_at: null });
  });

  it("rechaza publicar sin fecha (CHECK)", async () => {
    const draft = await createDraft("sin-fecha");
    const { error } = await admin().from("posts").update({ status: "published" }).eq("id", draft.id).select();
    expect(error?.code).toBe("23514");
  });

  it("rechaza un borrador con fecha de publicación (CHECK)", async () => {
    const draft = await createDraft("con-fecha");
    const { error } = await admin().from("posts").update({ published_at: new Date().toISOString() }).eq("id", draft.id).select();
    expect(error?.code).toBe("23514");
  });

  it.each([
    ["author_id", () => seed.userId],
    ["created_at", () => new Date().toISOString()],
  ])("no permite cambiar %s", async (column, value) => {
    const draft = await createDraft(`inmutable-${column}`.replaceAll("_", "-"));
    expectDenied(await admin().from("posts").update({ [column]: value() }).eq("id", draft.id).select());
  });

  it("borra una entrada y desaparecen sus categorías asignadas", async () => {
    const draft = await createDraft("borrado");
    const link = await admin().from("post_categories").insert({ post_id: draft.id, category_id: seed.category.id });
    expect(link.error).toBeNull();

    const removed = await admin().from("posts").delete().eq("id", draft.id).select();
    expect(removed.error).toBeNull();
    expect(removed.data).toHaveLength(1);
    expect(await exists("posts", "id", draft.id)).toBe(false);
    expect(await exists("post_categories", "post_id", draft.id)).toBe(false);
  });

  it("asigna y quita categorías a una entrada", async () => {
    const draft = await createDraft("categorias");
    const added = await admin().from("post_categories").insert({ post_id: draft.id, category_id: seed.spare.id });
    expect(added.error).toBeNull();
    expect(await exists("post_categories", "post_id", draft.id)).toBe(true);

    const removed = await admin().from("post_categories").delete().match({ post_id: draft.id, category_id: seed.spare.id }).select();
    expect(removed.error).toBeNull();
    expect(await exists("post_categories", "post_id", draft.id)).toBe(false);
  });

  it("rechaza un slug repetido (UNIQUE)", async () => {
    const { error } = await admin()
      .from("posts")
      .insert({ title: "Repetida", slug: seed.published.slug, author_id: seed.adminId })
      .select();
    expect(error?.code).toBe("23505");
  });

  it.each([
    ["con una ruta relativa", "../x"],
    ["con espacios y mayúsculas", "Hola Mundo"],
    ["de 81 caracteres", "a".repeat(81)],
  ])("rechaza un slug %s (CHECK)", async (_caso, slug) => {
    const { error } = await admin().from("posts").insert({ title: "Slug inválido", slug, author_id: seed.adminId }).select();
    expect(error?.code).toBe("23514");
  });

  it.each([
    ["vacío", ""],
    ["de 201 caracteres", "t".repeat(201)],
  ])("rechaza un título %s (CHECK)", async (_caso, title) => {
    const { error } = await admin().from("posts").insert({ title, slug: nextSlug("titulo"), author_id: seed.adminId }).select();
    expect(error?.code).toBe("23514");
  });

  it.each([
    ["una ruta relativa", "../x.png"],
    ["una carpeta", "a/b.png"],
    ["un SVG", `${randomUUID()}.svg`],
    ["una extensión peligrosa", `${randomUUID()}.exe`],
    ["un nombre que no es un UUID", "portada.png"],
  ])("rechaza como portada %s (CHECK)", async (_caso, path) => {
    const draft = await createDraft("portada-invalida");
    const { error } = await admin().from("posts").update({ cover_image_path: path }).eq("id", draft.id).select();
    expect(error?.code).toBe("23514");
  });

  it("acepta como portada un UUID con extensión permitida", async () => {
    const draft = await createDraft("portada-valida");
    const path = `${randomUUID()}.png`;
    const { data, error } = await admin().from("posts").update({ cover_image_path: path }).eq("id", draft.id).select("cover_image_path").single();
    expect(error).toBeNull();
    expect(data?.cover_image_path).toBe(path);
  });
});

describe("categorías", () => {
  it("crea, edita y borra una categoría", async () => {
    const slug = nextSlug("categoria");
    const created = await admin().from("categories").insert({ name: "Categoría", slug }).select("id").single();
    expect(created.error).toBeNull();
    const id = created.data?.id ?? "";

    const renamed = await admin().from("categories").update({ name: "Renombrada" }).eq("id", id).select("name").single();
    expect(renamed.error).toBeNull();
    expect(renamed.data?.name).toBe("Renombrada");

    const removed = await admin().from("categories").delete().eq("id", id).select();
    expect(removed.error).toBeNull();
    expect(await exists("categories", "id", id)).toBe(false);
  });

  it("rechaza una categoría con el slug repetido (UNIQUE)", async () => {
    const { error } = await admin().from("categories").insert({ name: "Repetida", slug: seed.category.slug }).select();
    expect(error?.code).toBe("23505");
  });
});
