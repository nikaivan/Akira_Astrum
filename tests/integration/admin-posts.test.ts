import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { performCreateCategory, performDeleteCategory, performRenameCategory } from "@/lib/admin/categories/service";
import * as messages from "@/lib/admin/messages";
import { performCreatePost, performDeletePost, performPublishPost, performUnpublishPost, performUpdatePost } from "@/lib/admin/posts/service";
import { anonClient, clientFor, identityOf, UNPRIVILEGED, type Role } from "./support/api";
import { seedContent, type Seed } from "./support/service-role";

/**
 * Los servicios del panel contra la API real del proyecto de TEST (RLS, privilegios de columna, CHECK y
 * claves únicas de verdad). Se usan los mismos `perform*` que las Server Actions, con la sesión del admin
 * de prueba. La comprobación de rol de las acciones (`withAdminAction`) se prueba en unitarios y en e2e.
 */

let seed: Seed;
beforeAll(async () => {
  seed = await seedContent("adm");
});
afterAll(async () => {
  await seed?.cleanup();
});

const admin = () => clientFor("admin");
const adminCtx = (input: unknown, now = new Date()) => ({ supabase: admin(), userId: identityOf("admin").id, input, now });
const categoryCtx = (input: unknown) => ({ supabase: admin(), userId: identityOf("admin").id, input });

let counter = 0;
const slug = (label: string) => `${seed.prefix}-${label}-${++counter}`;
const body = (extra: Record<string, unknown> = {}) => ({ title: `${seed.prefix} entrada`, slug: slug("p"), content: "Contenido **de prueba**", categoryIds: [], intent: "save", ...extra });

async function rowBySlug(value: string) {
  const { data, error } = await admin().from("posts").select("*").eq("slug", value).maybeSingle();
  expect(error).toBeNull();
  return data as Record<string, unknown> | null;
}
async function create(extra: Record<string, unknown> = {}) {
  const input = body(extra);
  const result = await performCreatePost(adminCtx(input));
  if (!result.ok) throw new Error(`No se pudo crear la entrada de prueba: ${result.message}`);
  return { id: result.id, slug: input.slug as string, input };
}
const countWithPrefix = async () => {
  const { count, error } = await admin().from("posts").select("id", { count: "exact", head: true }).like("slug", `${seed.prefix}%`);
  expect(error).toBeNull();
  return count ?? 0;
};
const anonSees = async (id: string) => {
  const { data, error } = await anonClient().from("posts").select("id").eq("id", id);
  expect(error).toBeNull();
  return (data ?? []).length === 1;
};
const categoryIdsOf = async (postId: string) => {
  const { data, error } = await admin().from("post_categories").select("category_id").eq("post_id", postId);
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.category_id as string).sort();
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("crear", () => {
  it("crea un borrador con el admin como autor y fechas fijadas por el servidor", async () => {
    const { slug: created } = await create();
    const row = await rowBySlug(created);
    expect(row).toMatchObject({ status: "draft", published_at: null, author_id: identityOf("admin").id, cover_image_path: null });
    expect(row?.created_at).toEqual(expect.any(String));
    expect(row?.updated_at).toEqual(expect.any(String));
  });

  it("el contenido se guarda exactamente como se escribió (no se sanitiza al guardar)", async () => {
    const content = '  <script>alert(1)</script>\n<img src=x onerror="x()"> [a](javascript:x)\n\n';
    const { slug: created } = await create({ content });
    expect((await rowBySlug(created))?.content_md).toBe(content);
  });

  it("asigna las categorías", async () => {
    const { id } = await create({ categoryIds: [seed.category.id, seed.spare.id] });
    expect(await categoryIdsOf(id)).toEqual([seed.category.id, seed.spare.id].sort());
  });

  it("crear y publicar fija published_at a la hora del reloj recibido", async () => {
    const now = new Date();
    const { slug: created } = await create({ intent: "publish" });
    // El reloj de create() es new Date() en el momento de la llamada: cerca del de este test.
    const row = await rowBySlug(created);
    expect(row?.status).toBe("published");
    expect(Math.abs(new Date(row?.published_at as string).getTime() - now.getTime())).toBeLessThan(60_000);
  });

  it("autogenera el slug desde el título y añade sufijo si ya existe", async () => {
    const title = `${seed.prefix} Título repetido`;
    const first = await performCreatePost(adminCtx(body({ title, slug: "" })));
    const second = await performCreatePost(adminCtx(body({ title, slug: "" })));
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    if (first.ok && second.ok) {
      expect(first.slug).toMatch(/titulo-repetido$/);
      expect(second.slug).toBe(`${first.slug}-2`);
    }
  });

  it("un slug repetido da el mensaje claro (clave única real) y no crea otra fila", async () => {
    const { slug: taken } = await create();
    const before = await countWithPrefix();
    const result = await performCreatePost(adminCtx(body({ slug: taken })));
    expect(result).toMatchObject({ ok: false, fieldErrors: { slug: messages.SLUG_TAKEN } });
    expect(await countWithPrefix()).toBe(before);
  });

  it("una categoría inexistente se rechaza y no se crea la entrada", async () => {
    const before = await countWithPrefix();
    const result = await performCreatePost(adminCtx(body({ categoryIds: [randomUUID()] })));
    expect(result).toMatchObject({ ok: false, fieldErrors: { categoryIds: messages.CATEGORY_MISSING } });
    expect(await countWithPrefix()).toBe(before);
  });
});

describe("mass assignment contra la base de datos real", () => {
  it.each([
    ["author_id", () => identityOf("user").id],
    ["created_at", () => "2000-01-01T00:00:00Z"],
    ["updated_at", () => "2000-01-01T00:00:00Z"],
    ["published_at", () => "2000-01-01T00:00:00Z"],
    ["status", () => "published"],
  ])("un envío con %s se rechaza entero y no crea nada", async (field, value) => {
    const before = await countWithPrefix();
    const result = await performCreatePost(adminCtx(body({ [field]: value() })));
    expect(result).toMatchObject({ ok: false, message: messages.INVALID_REQUEST });
    expect(await countWithPrefix()).toBe(before);
  });
});

describe("editar", () => {
  it("cambia título, slug y contenido, y renueva updated_at", async () => {
    const { id, slug: original } = await create();
    const before = await rowBySlug(original);
    await sleep(50);
    const newSlug = slug("editado");
    const result = await performUpdatePost(adminCtx({ id, title: "Título nuevo", slug: newSlug, content: "Nuevo contenido", categoryIds: [], intent: "save" }));
    expect(result).toMatchObject({ ok: true });
    const after = await rowBySlug(newSlug);
    expect(after).toMatchObject({ title: "Título nuevo", content_md: "Nuevo contenido", author_id: before?.author_id, created_at: before?.created_at });
    expect(new Date(after?.updated_at as string).getTime()).toBeGreaterThan(new Date(before?.updated_at as string).getTime());
  });

  it("reemplaza las categorías sin perder ninguna en el camino", async () => {
    const { id, slug: current } = await create({ categoryIds: [seed.category.id] });
    const result = await performUpdatePost(adminCtx({ id, title: "T", slug: current, content: "", categoryIds: [seed.spare.id], intent: "save" }));
    expect(result).toMatchObject({ ok: true });
    expect(await categoryIdsOf(id)).toEqual([seed.spare.id]);
  });

  it("el slug de una entrada publicada no se puede cambiar", async () => {
    const { id, slug: current } = await create({ intent: "publish" });
    const result = await performUpdatePost(adminCtx({ id, title: "T", slug: slug("otro"), content: "", categoryIds: [], intent: "save" }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { slug: messages.SLUG_LOCKED } });
    expect((await rowBySlug(current))?.slug).toBe(current);
  });

  it("guardar una entrada publicada conserva su fecha de publicación", async () => {
    const { id, slug: current } = await create({ intent: "publish" });
    const before = await rowBySlug(current);
    await performUpdatePost(adminCtx({ id, title: "Solo el título", slug: current, content: "", categoryIds: [], intent: "save" }));
    expect(await rowBySlug(current)).toMatchObject({ status: "published", published_at: before?.published_at, title: "Solo el título" });
  });
});

describe("publicar, despublicar y visibilidad pública", () => {
  it("publicar fija published_at, despublicar lo limpia y republicar fija una fecha nueva", async () => {
    const { id, slug: current } = await create();
    const t1 = new Date();
    expect(await performPublishPost(adminCtx({ id }, t1))).toMatchObject({ ok: true });
    expect(new Date((await rowBySlug(current))?.published_at as string).getTime()).toBe(t1.getTime());

    expect(await performUnpublishPost(adminCtx({ id }))).toMatchObject({ ok: true });
    expect(await rowBySlug(current)).toMatchObject({ status: "draft", published_at: null });

    const t2 = new Date(t1.getTime() + 60_000);
    await performPublishPost(adminCtx({ id }, t2));
    expect(new Date((await rowBySlug(current))?.published_at as string).getTime()).toBe(t2.getTime());
  });

  it("dos publicaciones simultáneas: una gana y la otra recibe el aviso, sin pisar la fecha", async () => {
    const { id, slug: current } = await create();
    const results = await Promise.all([performPublishPost(adminCtx({ id }, new Date(Date.now()))), performPublishPost(adminCtx({ id }, new Date(Date.now() + 5_000)))]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({ message: messages.ALREADY_PUBLISHED });
    expect((await rowBySlug(current))?.status).toBe("published");
  });

  it("el anónimo no ve un borrador (ni conociendo su id); lo ve al publicar y deja de verlo al despublicar o eliminar", async () => {
    const { id } = await create();
    expect(await anonSees(id)).toBe(false);
    await performPublishPost(adminCtx({ id }));
    expect(await anonSees(id)).toBe(true);
    await performUnpublishPost(adminCtx({ id }));
    expect(await anonSees(id)).toBe(false);
    await performPublishPost(adminCtx({ id }));
    expect(await performDeletePost(adminCtx({ id, confirm: "eliminar" }))).toMatchObject({ ok: true });
    expect(await anonSees(id)).toBe(false);
  });
});

describe("eliminar", () => {
  it("sin confirmación no se borra nada", async () => {
    const { id } = await create();
    expect(await performDeletePost(adminCtx({ id }))).toMatchObject({ ok: false });
    expect(await performDeletePost(adminCtx({ id, confirm: "si" }))).toMatchObject({ ok: false });
    const { data } = await admin().from("posts").select("id").eq("id", id);
    expect(data).toHaveLength(1);
  });

  it("borra la entrada y sus filas de post_categories", async () => {
    const { id } = await create({ categoryIds: [seed.category.id] });
    expect(await performDeletePost(adminCtx({ id, confirm: "eliminar" }))).toMatchObject({ ok: true });
    expect(await categoryIdsOf(id)).toEqual([]);
    expect((await admin().from("posts").select("id").eq("id", id)).data).toEqual([]);
  });

  it("una entrada que no existe da el mensaje claro", async () => {
    expect(await performDeletePost(adminCtx({ id: randomUUID(), confirm: "eliminar" }))).toMatchObject({ ok: false, message: messages.POST_NOT_FOUND });
  });
});

describe("categorías", () => {
  const name = (label: string) => `${seed.prefix} ${label}`;

  it("crea una categoría con slug generado y único", async () => {
    const first = await performCreateCategory(categoryCtx({ name: name("Signos") }));
    const second = await performCreateCategory(categoryCtx({ name: name("Signos") }));
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    if (first.ok && second.ok) expect(second.slug).toBe(`${first.slug}-2`);
  });

  it("renombrar cambia el nombre y conserva el slug", async () => {
    const created = await performCreateCategory(categoryCtx({ name: name("Original") }));
    if (!created.ok) throw new Error("No se creó la categoría");
    expect(await performRenameCategory(categoryCtx({ id: created.id, name: name("Renombrada") }))).toMatchObject({ ok: true });
    const { data } = await admin().from("categories").select("name, slug").eq("id", created.id).single();
    expect(data).toMatchObject({ name: name("Renombrada"), slug: created.slug });
  });

  it("eliminar una categoría con entradas conserva las entradas y quita solo las uniones", async () => {
    const created = await performCreateCategory(categoryCtx({ name: name("Con entradas") }));
    if (!created.ok) throw new Error("No se creó la categoría");
    const a = await create({ categoryIds: [created.id], intent: "publish" });
    const b = await create({ categoryIds: [created.id, seed.category.id] });

    const result = await performDeleteCategory(categoryCtx({ id: created.id, confirm: "eliminar" }));
    expect(result).toMatchObject({ ok: true, removedFromPosts: 2 });
    expect((await admin().from("categories").select("id").eq("id", created.id)).data).toEqual([]);
    expect(await rowBySlug(a.slug)).not.toBeNull();
    expect(await rowBySlug(b.slug)).not.toBeNull();
    expect(await categoryIdsOf(a.id)).toEqual([]);
    expect(await categoryIdsOf(b.id)).toEqual([seed.category.id]);
    expect(await anonSees(a.id)).toBe(true);
  });

  it("sin confirmación no se elimina", async () => {
    const created = await performCreateCategory(categoryCtx({ name: name("Protegida") }));
    if (!created.ok) throw new Error("No se creó la categoría");
    expect(await performDeleteCategory(categoryCtx({ id: created.id }))).toMatchObject({ ok: false });
    expect((await admin().from("categories").select("id").eq("id", created.id)).data).toHaveLength(1);
  });
});

describe("A01: anónimo, autenticado sin rol admin y sin perfil no modifican nada", () => {
  const actor = (role: Exclude<Role, "admin">) => ({
    supabase: clientFor(role),
    userId: role === "anon" ? randomUUID() : identityOf(role).id,
    now: new Date(),
  });

  it.each(UNPRIVILEGED)("%s: ninguna operación del panel escribe", async (role) => {
    const { id, slug: existing } = await create({ categoryIds: [seed.category.id] });
    const before = await rowBySlug(existing);
    const total = await countWithPrefix();
    const who = actor(role);

    const attempts = await Promise.all([
      performCreatePost({ ...who, input: body() }),
      performUpdatePost({ ...who, input: { id, title: "Hackeado", slug: existing, content: "x", categoryIds: [], intent: "save" } }),
      performPublishPost({ ...who, input: { id } }),
      performUnpublishPost({ ...who, input: { id } }),
      performDeletePost({ ...who, input: { id, confirm: "eliminar" } }),
      performCreateCategory({ ...who, input: { name: `${seed.prefix} intruso` } }),
      performDeleteCategory({ ...who, input: { id: seed.category.id, confirm: "eliminar" } }),
    ]);

    for (const attempt of attempts) expect(attempt.ok).toBe(false);
    expect(await countWithPrefix()).toBe(total);
    expect(await rowBySlug(existing)).toEqual(before);
    expect(await categoryIdsOf(id)).toEqual([seed.category.id]);
    expect((await admin().from("categories").select("id").eq("id", seed.category.id)).data).toHaveLength(1);
    expect((await admin().from("categories").select("id").like("slug", `${seed.prefix}-intruso%`)).data).toEqual([]);
  });
});
