import { describe, expect, it } from "vitest";
import * as messages from "@/lib/admin/messages";
import { performCreatePost, performDeletePost, performUpdatePost } from "@/lib/admin/posts/service";
import { ADMIN_ID, createFake, draftPost, POST_DRAFT, POST_PUBLISHED, publishedPost, type FakeOptions } from "./support";

const ORIGIN = "https://proyecto.supabase.co";
const BASE = `${ORIGIN}/storage/v1/object/public/post-images/`;
const NOW = new Date("2026-11-04T10:00:00.000Z");
const IMG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.png";
const IMG_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2.jpg";
const IMG_C = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3.webp";
const COVER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png";
const OTHER_POST = "77777777-7777-4777-8777-777777777777";

const line = (name: string, alt = "Texto") => `![${alt}](${BASE}${name})`;
const content = (...names: string[]) => `Inicio\n\n${names.map((name) => line(name)).join("\n\n")}\n\nFin`;
const removals = (fake: ReturnType<typeof createFake>) => fake.storage.log.filter((entry) => entry.op === "remove").flatMap((entry) => entry.names);

const seeded = (posts: Record<string, unknown>[], storageObjects: string[], extra: FakeOptions = {}): FakeOptions => ({ posts, storageObjects, ...extra });
const withContent = (id: string, text: string, extra: Record<string, unknown> = {}) =>
  id === POST_PUBLISHED ? publishedPost({ content_md: text, ...extra }) : draftPost({ id, content_md: text, ...extra });

const edit = (fake: ReturnType<typeof createFake>, input: Record<string, unknown>, storageOrigin: string | null | undefined = ORIGIN) =>
  performUpdatePost({
    supabase: fake.client,
    userId: ADMIN_ID,
    input: { id: POST_DRAFT, title: "Borrador uno", slug: "borrador-uno", categoryIds: [], intent: "save", ...input },
    now: NOW,
    storageOrigin,
  });
const remove = (fake: ReturnType<typeof createFake>, id: string, storageOrigin: string | null | undefined = ORIGIN) =>
  performDeletePost({ supabase: fake.client, userId: ADMIN_ID, input: { id, confirm: "eliminar" }, now: NOW, storageOrigin });

describe("eliminar la entrada borra también las imágenes de su contenido", () => {
  it("borra las imágenes del texto y la portada, y solo esas", async () => {
    const fake = createFake(seeded([publishedPost({ content_md: content(IMG_A, IMG_B), cover_image_path: COVER, cover_alt: "Portada" })], [IMG_A, IMG_B, IMG_C, COVER]));
    const result = await remove(fake, POST_PUBLISHED);
    expect(result).toMatchObject({ ok: true });
    expect(result).not.toHaveProperty("warning");
    expect(removals(fake).sort()).toEqual([IMG_A, IMG_B, COVER].sort());
    expect(fake.storage.names).toEqual([IMG_C]);
  });

  it("una imagen repetida en el texto se borra una sola vez", async () => {
    const fake = createFake(seeded([draftPost({ content_md: `${line(IMG_A)}\n\n${line(IMG_A)}` })], [IMG_A]));
    await remove(fake, POST_DRAFT);
    expect(removals(fake)).toEqual([IMG_A]);
  });

  it("no borra un archivo que otra entrada sigue usando en su contenido", async () => {
    const fake = createFake(
      seeded([withContent(POST_DRAFT, content(IMG_A, IMG_B)), withContent(OTHER_POST, `Otra entrada\n\n${line(IMG_A)}`, { slug: "otra", title: "Otra" })], [IMG_A, IMG_B]),
    );
    expect(await remove(fake, POST_DRAFT)).toMatchObject({ ok: true });
    expect(removals(fake)).toEqual([IMG_B]);
    expect(fake.storage.names).toEqual([IMG_A]);
  });

  it("si el borrado de un archivo falla, la entrada ya está eliminada y se avisa", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A) })], [IMG_A], { storageFailures: [{ op: "remove" }] }));
    expect(await remove(fake, POST_DRAFT)).toMatchObject({ ok: true, warning: messages.COVER_NOT_REMOVED_ON_DELETE });
    expect(fake.posts).toEqual([]);
  });

  it("si la entrada no se puede eliminar, no se borra ningún archivo", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A) })], [IMG_A], { failures: [{ table: "posts", op: "delete", error: { code: "XX000", message: "caída" } }] }));
    expect(await remove(fake, POST_DRAFT)).toMatchObject({ ok: false });
    expect(removals(fake)).toEqual([]);
    expect(fake.storage.names).toEqual([IMG_A]);
  });

  it.each([
    ["otro host", `![x](https://evil.test/storage/v1/object/public/post-images/${IMG_A})`],
    ["otro bucket", `![x](${ORIGIN}/storage/v1/object/public/otro/${IMG_A})`],
    ["un nombre que no es el generado", `![x](${BASE}portada.png)`],
    ["un salto de directorio", `![x](${BASE}../${IMG_A})`],
  ])("una imagen de %s en el texto no provoca ningún borrado", async (_caso, text) => {
    const fake = createFake(seeded([draftPost({ content_md: text })], [IMG_A]));
    expect(await remove(fake, POST_DRAFT)).toMatchObject({ ok: true });
    expect(removals(fake)).toEqual([]);
    expect(fake.storage.names).toEqual([IMG_A]);
  });

  it("sin un origen de Storage configurado, las imágenes del texto no se tocan (la portada sí se borra, como antes)", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A), cover_image_path: COVER, cover_alt: "Portada" })], [IMG_A, COVER]));
    expect(await remove(fake, POST_DRAFT, null)).toMatchObject({ ok: true });
    expect(removals(fake)).toEqual([COVER]);
  });
});

describe("editar: se borran las imágenes que ya no aparecen en el texto", () => {
  it("quitar una línea de imagen borra su archivo y conserva las demás", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A, IMG_B) })], [IMG_A, IMG_B]));
    const result = await edit(fake, { content: content(IMG_B) });
    expect(result).toMatchObject({ ok: true });
    expect(result).not.toHaveProperty("warning");
    expect(removals(fake)).toEqual([IMG_A]);
    expect(fake.storage.names).toEqual([IMG_B]);
  });

  it("guardar sin cambiar las imágenes no borra nada", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A, IMG_B) })], [IMG_A, IMG_B]));
    await edit(fake, { content: `${content(IMG_A, IMG_B)}\n\nUna frase más.` });
    expect(removals(fake)).toEqual([]);
  });

  it("mover la imagen de sitio dentro del texto no la borra", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A) })], [IMG_A]));
    await edit(fake, { content: `${line(IMG_A)}\n\nAhora al principio` });
    expect(removals(fake)).toEqual([]);
  });

  it("cambiar solo el texto alternativo de la línea no la borra", async () => {
    const fake = createFake(seeded([draftPost({ content_md: `${line(IMG_A, "Viejo")}` })], [IMG_A]));
    await edit(fake, { content: line(IMG_A, "Nuevo") });
    expect(removals(fake)).toEqual([]);
  });

  it("añadir una imagen nueva al texto no borra nada", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A) })], [IMG_A, IMG_B]));
    await edit(fake, { content: content(IMG_A, IMG_B) });
    expect(removals(fake)).toEqual([]);
  });

  it("vaciar el contenido borra todas las imágenes que tenía", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A, IMG_B) })], [IMG_A, IMG_B]));
    await edit(fake, { content: "" });
    expect(removals(fake).sort()).toEqual([IMG_A, IMG_B].sort());
  });

  it("no borra un archivo que otra entrada sigue usando", async () => {
    const fake = createFake(
      seeded([draftPost({ content_md: content(IMG_A) }), draftPost({ id: OTHER_POST, slug: "otra", title: "Otra", content_md: line(IMG_A) })], [IMG_A]),
    );
    await edit(fake, { content: "Sin imágenes" });
    expect(removals(fake)).toEqual([]);
    expect(fake.storage.names).toEqual([IMG_A]);
  });

  it("si el borrado falla, los cambios se guardan y se avisa", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A) })], [IMG_A], { storageFailures: [{ op: "remove" }] }));
    expect(await edit(fake, { content: "Sin imágenes" })).toMatchObject({ ok: true, warning: messages.COVER_OLD_NOT_REMOVED });
    expect(fake.posts[0]).toMatchObject({ content_md: "Sin imágenes" });
  });

  it("si el guardado falla, no se borra ningún archivo (la entrada sigue apuntando a ellos)", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A) })], [IMG_A], { failures: [{ table: "posts", op: "update", error: { code: "XX000", message: "caída" } }] }));
    expect(await edit(fake, { content: "Sin imágenes" })).toMatchObject({ ok: false });
    expect(removals(fake)).toEqual([]);
    expect(fake.storage.names).toEqual([IMG_A]);
  });

  it("si otra petición cambió el estado entre medias y no se guarda nada, no se borra ningún archivo", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A) })], [IMG_A]));
    const result = await edit(fake, { content: "Sin imágenes", intent: "unpublish" });
    expect(result).toMatchObject({ ok: false });
    expect(removals(fake)).toEqual([]);
  });

  it("cambia la portada y quita una imagen del texto a la vez: se borran ambas", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A), cover_image_path: COVER, cover_alt: "Portada" })], [IMG_A, COVER]));
    expect(await edit(fake, { content: "Sin imágenes", removeCover: "on" })).toMatchObject({ ok: true });
    expect(removals(fake).sort()).toEqual([IMG_A, COVER].sort());
  });

  it("una imagen externa o con un nombre no generado no provoca ningún borrado", async () => {
    const hostile = `![x](https://evil.test/storage/v1/object/public/post-images/${IMG_A})\n\n![y](${BASE}portada.png)\n\n![z](${BASE}../${IMG_A})`;
    const fake = createFake(seeded([draftPost({ content_md: hostile })], [IMG_A]));
    expect(await edit(fake, { content: "Limpio" })).toMatchObject({ ok: true });
    expect(removals(fake)).toEqual([]);
    expect(fake.storage.names).toEqual([IMG_A]);
  });

  it("sin un origen de Storage configurado, las imágenes del texto no se tocan", async () => {
    const fake = createFake(seeded([draftPost({ content_md: content(IMG_A) })], [IMG_A]));
    expect(await edit(fake, { content: "Sin imágenes" }, null)).toMatchObject({ ok: true });
    expect(removals(fake)).toEqual([]);
  });

  it("una entrada publicada también limpia sus imágenes", async () => {
    const fake = createFake(seeded([publishedPost({ content_md: content(IMG_A, IMG_B) })], [IMG_A, IMG_B]));
    const result = await performUpdatePost({
      supabase: fake.client,
      userId: ADMIN_ID,
      input: { id: POST_PUBLISHED, title: "Publicada uno", slug: "publicada-uno", content: content(IMG_B), categoryIds: [], intent: "save" },
      now: NOW,
      storageOrigin: ORIGIN,
    });
    expect(result).toMatchObject({ ok: true });
    expect(removals(fake)).toEqual([IMG_A]);
  });
});

describe("crear no borra nada", () => {
  it("una entrada nueva con imágenes en el texto no toca Storage", async () => {
    const fake = createFake({ storageObjects: [IMG_A] });
    const result = await performCreatePost({
      supabase: fake.client,
      userId: ADMIN_ID,
      input: { title: "Nueva", slug: "", content: content(IMG_A), categoryIds: [], intent: "save" },
      now: NOW,
      storageOrigin: ORIGIN,
    });
    expect(result).toMatchObject({ ok: true });
    expect(fake.storage.log).toEqual([]);
  });
});
