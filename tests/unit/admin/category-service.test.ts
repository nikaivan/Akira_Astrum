import { describe, expect, it } from "vitest";
import { performCreateCategory, performDeleteCategory, performRenameCategory } from "@/lib/admin/categories/service";
import * as messages from "@/lib/admin/messages";
import { ADMIN_ID, CAT_A, CAT_B, CAT_MISSING, category, createFake, draftPost, LEAK_PATTERN, LEAKY_ERROR, POST_DRAFT, POST_PUBLISHED, publishedPost, type FakeOptions } from "./support";

function setup(options: FakeOptions = {}) {
  const fake = createFake({
    categories: [category(CAT_A, "Fuego", "fuego"), category(CAT_B, "Agua", "agua")],
    posts: [draftPost(), publishedPost()],
    postCategories: [
      { post_id: POST_DRAFT, category_id: CAT_A },
      { post_id: POST_PUBLISHED, category_id: CAT_A },
      { post_id: POST_PUBLISHED, category_id: CAT_B },
    ],
    ...options,
  });
  return { fake, ctx: (input: unknown) => ({ supabase: fake.client, userId: ADMIN_ID, input }) };
}

describe("performCreateCategory", () => {
  it("crea la categoría con el slug generado a partir del nombre", async () => {
    const { fake, ctx } = setup();
    const result = await performCreateCategory(ctx({ name: "Signos de Tierra" }));
    expect(result).toMatchObject({ ok: true, slug: "signos-de-tierra" });
    expect(fake.categories.at(-1)).toMatchObject({ name: "Signos de Tierra", slug: "signos-de-tierra" });
  });

  it("solo envía name y slug", async () => {
    const { fake, ctx } = setup();
    await performCreateCategory(ctx({ name: "Aire" }));
    const [entry] = fake.writes.filter((write) => write.table === "categories");
    expect(Object.keys(entry.values as object).sort()).toEqual(["name", "slug"]);
  });

  it("si el slug ya existe añade un sufijo numérico", async () => {
    const { fake, ctx } = setup();
    await performCreateCategory(ctx({ name: "Fuego" }));
    expect(fake.categories.at(-1)?.slug).toBe("fuego-2");
  });

  it("un nombre imposible de convertir en slug da un error de campo y no escribe", async () => {
    const { fake, ctx } = setup();
    expect(await performCreateCategory(ctx({ name: "🔥🔥" }))).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String) } });
    expect(fake.writes).toEqual([]);
  });

  it("el slug no se puede enviar y cualquier campo de más rechaza el envío", async () => {
    const { fake, ctx } = setup();
    expect(await performCreateCategory(ctx({ name: "Aire", slug: "aire" }))).toMatchObject({ ok: false, message: messages.INVALID_REQUEST });
    expect(await performCreateCategory(ctx({ name: "Aire", created_at: "2020-01-01" }))).toMatchObject({ ok: false });
    expect(fake.writes).toEqual([]);
  });

  it("un nombre vacío o demasiado largo se rechaza", async () => {
    const { fake, ctx } = setup();
    expect(await performCreateCategory(ctx({ name: "  " }))).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String) } });
    expect(await performCreateCategory(ctx({ name: "a".repeat(61) }))).toMatchObject({ ok: false });
    expect(fake.writes).toEqual([]);
  });

  it("un fallo de la base de datos no filtra detalles", async () => {
    const { ctx } = setup({ failures: [{ table: "categories", op: "insert", error: LEAKY_ERROR }] });
    const result = await performCreateCategory(ctx({ name: "Aire" }));
    expect(result).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });
});

describe("performRenameCategory", () => {
  it("cambia solo el nombre y conserva el slug", async () => {
    const { fake, ctx } = setup();
    expect(await performRenameCategory(ctx({ id: CAT_A, name: "Signos de fuego" }))).toMatchObject({ ok: true });
    expect(fake.categories.find((row) => row.id === CAT_A)).toMatchObject({ name: "Signos de fuego", slug: "fuego" });
    const [entry] = fake.writes.filter((write) => write.table === "categories");
    expect(Object.keys(entry.values as object)).toEqual(["name"]);
  });

  it("una categoría inexistente da el mensaje claro", async () => {
    const { ctx } = setup();
    expect(await performRenameCategory(ctx({ id: CAT_MISSING, name: "X" }))).toMatchObject({ ok: false, message: messages.CATEGORY_NOT_FOUND });
  });

  it("rechaza un envío con slug u otros campos", async () => {
    const { fake, ctx } = setup();
    expect(await performRenameCategory(ctx({ id: CAT_A, name: "X", slug: "x" }))).toMatchObject({ ok: false });
    expect(fake.writes).toEqual([]);
  });
});

describe("performDeleteCategory", () => {
  it("sin la confirmación «eliminar» no borra nada", async () => {
    const { fake, ctx } = setup();
    expect(await performDeleteCategory(ctx({ id: CAT_A }))).toMatchObject({ ok: false });
    expect(fake.writes).toEqual([]);
  });

  it("borra la categoría, conserva las entradas e informa de cuántas la usaban", async () => {
    const { fake, ctx } = setup();
    const result = await performDeleteCategory(ctx({ id: CAT_A, confirm: "eliminar" }));
    expect(result).toMatchObject({ ok: true, removedFromPosts: 2 });
    expect(fake.categories.map((row) => row.id)).toEqual([CAT_B]);
    expect(fake.posts).toHaveLength(2);
    expect(fake.categoryIdsOf(POST_DRAFT)).toEqual([]);
    expect(fake.categoryIdsOf(POST_PUBLISHED)).toEqual([CAT_B]);
  });

  it("una categoría sin entradas informa de cero", async () => {
    const { ctx } = setup({ postCategories: [] });
    expect(await performDeleteCategory(ctx({ id: CAT_B, confirm: "eliminar" }))).toMatchObject({ ok: true, removedFromPosts: 0 });
  });

  it("una categoría inexistente da el mensaje claro", async () => {
    const { ctx } = setup();
    expect(await performDeleteCategory(ctx({ id: CAT_MISSING, confirm: "eliminar" }))).toMatchObject({ ok: false, message: messages.CATEGORY_NOT_FOUND });
  });

  it("un fallo de la base de datos no filtra detalles", async () => {
    const { ctx } = setup({ failures: [{ table: "categories", op: "delete", error: LEAKY_ERROR }] });
    const result = await performDeleteCategory(ctx({ id: CAT_A, confirm: "eliminar" }));
    expect(result).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });
});
