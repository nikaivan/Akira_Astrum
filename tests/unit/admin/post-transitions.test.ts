import { describe, expect, it } from "vitest";
import * as messages from "@/lib/admin/messages";
import { performDeletePost, performPublishPost, performUnpublishPost } from "@/lib/admin/posts/service";
import { ADMIN_ID, CAT_A, category, createFake, draftPost, LEAK_PATTERN, LEAKY_ERROR, OLD_DATE, post, POST_DRAFT, POST_MISSING, POST_PUBLISHED, publishedPost, type FakeOptions } from "./support";

const T1 = new Date("2026-11-04T10:00:00.000Z");
const T2 = new Date("2026-11-05T12:30:00.000Z");

function setup(options: FakeOptions = {}) {
  const fake = createFake({ categories: [category(CAT_A, "Fuego", "fuego")], posts: [draftPost(), publishedPost()], postCategories: [{ post_id: POST_PUBLISHED, category_id: CAT_A }], ...options });
  const ctx = (input: unknown, now = T1) => ({ supabase: fake.client, userId: ADMIN_ID, input, now });
  return { fake, ctx };
}

describe("performPublishPost", () => {
  it("publica un borrador y fija published_at con el reloj recibido", async () => {
    const { fake, ctx } = setup();
    expect(await performPublishPost(ctx({ id: POST_DRAFT }))).toMatchObject({ ok: true });
    expect(fake.postById(POST_DRAFT)).toMatchObject({ status: "published", published_at: T1.toISOString() });
  });

  it("solo escribe status y published_at", async () => {
    const { fake, ctx } = setup();
    await performPublishPost(ctx({ id: POST_DRAFT }));
    const keys = fake.writes.flatMap((entry) => Object.keys((entry.values ?? {}) as object)).sort();
    expect(keys).toEqual(["published_at", "status"]);
  });

  it("publicar algo ya publicado da el aviso y conserva la fecha", async () => {
    const { fake, ctx } = setup();
    expect(await performPublishPost(ctx({ id: POST_PUBLISHED }))).toMatchObject({ ok: false, message: messages.ALREADY_PUBLISHED });
    expect(fake.postById(POST_PUBLISHED)?.published_at).toBe(OLD_DATE);
  });

  it("una entrada inexistente da el mensaje claro", async () => {
    const { ctx } = setup();
    expect(await performPublishPost(ctx({ id: POST_MISSING }))).toMatchObject({ ok: false, message: messages.POST_NOT_FOUND });
  });

  it("un estado incoherente falla cerrado con el error genérico y no escribe", async () => {
    const { fake, ctx } = setup({ posts: [draftPost({ published_at: OLD_DATE })] });
    const result = await performPublishPost(ctx({ id: POST_DRAFT }));
    expect(result).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(fake.writes).toEqual([]);
  });

  it("un id inválido o campos de más se rechazan sin escribir", async () => {
    const { fake, ctx } = setup();
    for (const input of [{ id: "no-uuid" }, {}, { id: POST_DRAFT, published_at: "2020-01-01T00:00:00Z" }, { id: POST_DRAFT, status: "published" }, null]) {
      expect(await performPublishPost(ctx(input))).toMatchObject({ ok: false });
    }
    expect(fake.writes).toEqual([]);
  });

  it("un fallo de la base de datos no filtra detalles", async () => {
    const { ctx } = setup({ failures: [{ table: "posts", op: "update", error: LEAKY_ERROR }] });
    const result = await performPublishPost(ctx({ id: POST_DRAFT }));
    expect(result).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });
});

describe("performUnpublishPost", () => {
  it("despublica y limpia published_at (ADR 0006)", async () => {
    const { fake, ctx } = setup();
    expect(await performUnpublishPost(ctx({ id: POST_PUBLISHED }))).toMatchObject({ ok: true });
    expect(fake.postById(POST_PUBLISHED)).toMatchObject({ status: "draft", published_at: null });
  });

  it("despublicar un borrador da el aviso", async () => {
    const { ctx } = setup();
    expect(await performUnpublishPost(ctx({ id: POST_DRAFT }))).toMatchObject({ ok: false, message: messages.ALREADY_DRAFT });
  });

  it("al republicar se fija una fecha nueva, no la de la primera publicación", async () => {
    const { fake, ctx } = setup();
    await performUnpublishPost(ctx({ id: POST_PUBLISHED }));
    await performPublishPost(ctx({ id: POST_PUBLISHED }, T2));
    expect(fake.postById(POST_PUBLISHED)?.published_at).toBe(T2.toISOString());
  });

  it("dos peticiones a la vez: una gana y la otra recibe el aviso", async () => {
    const { ctx } = setup();
    const results = await Promise.all([performUnpublishPost(ctx({ id: POST_PUBLISHED })), performUnpublishPost(ctx({ id: POST_PUBLISHED }))]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({ message: messages.ALREADY_DRAFT });
  });
});

describe("performDeletePost", () => {
  it("sin la confirmación «eliminar» no borra nada", async () => {
    const { fake, ctx } = setup();
    for (const input of [{ id: POST_DRAFT }, { id: POST_DRAFT, confirm: "" }, { id: POST_DRAFT, confirm: "si" }]) {
      expect(await performDeletePost(ctx(input))).toMatchObject({ ok: false });
    }
    expect(fake.writes).toEqual([]);
    expect(fake.posts).toHaveLength(2);
  });

  it("con la confirmación borra la entrada y sus categorías asignadas", async () => {
    const { fake, ctx } = setup();
    expect(await performDeletePost(ctx({ id: POST_PUBLISHED, confirm: "eliminar" }))).toMatchObject({ ok: true });
    expect(fake.postById(POST_PUBLISHED)).toBeUndefined();
    expect(fake.categoryIdsOf(POST_PUBLISHED)).toEqual([]);
    expect(fake.categories).toHaveLength(1);
  });

  it("una entrada inexistente da el mensaje claro", async () => {
    const { ctx } = setup();
    expect(await performDeletePost(ctx({ id: POST_MISSING, confirm: "eliminar" }))).toMatchObject({ ok: false, message: messages.POST_NOT_FOUND });
  });

  it("no borra otras entradas", async () => {
    const other = post({ id: crypto.randomUUID(), slug: "otra" });
    const { fake, ctx } = setup({ posts: [draftPost(), publishedPost(), other] });
    await performDeletePost(ctx({ id: POST_DRAFT, confirm: "eliminar" }));
    expect(fake.posts.map((row) => row.slug).sort()).toEqual(["otra", "publicada-uno"]);
  });

  it("un campo de más rechaza el envío sin borrar", async () => {
    const { fake, ctx } = setup();
    expect(await performDeletePost(ctx({ id: POST_DRAFT, confirm: "eliminar", author_id: ADMIN_ID }))).toMatchObject({ ok: false });
    expect(fake.posts).toHaveLength(2);
  });

  it("un fallo de la base de datos no filtra detalles", async () => {
    const { ctx } = setup({ failures: [{ table: "posts", op: "delete", error: LEAKY_ERROR }] });
    const result = await performDeletePost(ctx({ id: POST_DRAFT, confirm: "eliminar" }));
    expect(result).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });
});
