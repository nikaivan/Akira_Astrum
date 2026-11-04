import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as messages from "@/lib/admin/messages";
import { performUploadPostImage } from "@/lib/admin/posts/image-service";
import { performCreatePost, performDeletePost, performUpdatePost } from "@/lib/admin/posts/service";
import { getPublishedPost } from "@/lib/blog/queries";
import { EXE, HTML, makePng, makePngOfSize, SVG } from "../unit/storage/images";
import { anonClient, clientFor, identityOf, testUrl, UNPRIVILEGED, type Role } from "./support/api";
import { removeStorageObjects, seedContent, type Seed } from "./support/service-role";

/**
 * Imágenes dentro del contenido contra la API real del proyecto de TEST: Storage, políticas del bucket y limpieza al editar y
 * al eliminar. Se usan los mismos `perform*` que las Server Actions con la sesión del admin de prueba.
 */

const BUCKET = "post-images";
const MIB = 1024 * 1024;
const GENERATED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

let seed: Seed;
const uploaded = new Set<string>();

beforeAll(async () => {
  seed = await seedContent("content-image");
});
afterAll(async () => {
  await removeStorageObjects([...uploaded]);
  await seed?.cleanup();
});

const admin = () => clientFor("admin");
const file = (bytes: Uint8Array, name = "imagen.png", type = "image/png") => new File([new Uint8Array(bytes)], name, { type });
const nameOf = (url: string) => url.slice(url.lastIndexOf("/") + 1);

async function upload(alt = "Texto alternativo de prueba", image: File = file(makePng({ width: 16, height: 16 })), role: Role = "admin") {
  const result = await performUploadPostImage({ supabase: clientFor(role), userId: role === "anon" ? randomUUID() : identityOf(role).id, input: { image, alt }, storageOrigin: testUrl() });
  if (result.ok) uploaded.add(nameOf(result.url));
  return result;
}
const bucketNames = async () => {
  const { data, error } = await admin().storage.from(BUCKET).list(undefined, { limit: 1000 });
  expect(error).toBeNull();
  return new Set((data ?? []).map((object) => object.name));
};
const servedAsImage = async (name: string) => {
  const url = `${anonClient().storage.from(BUCKET).getPublicUrl(name).data.publicUrl}?t=${randomUUID()}`;
  const response = await fetch(url);
  return response.status === 200 && (response.headers.get("content-type") ?? "").startsWith("image/");
};

let counter = 0;
const ctx = (input: unknown) => ({ supabase: admin(), userId: identityOf("admin").id, input, now: new Date(), storageOrigin: testUrl() });
const body = (content: string, extra: Record<string, unknown> = {}) => ({ title: `${seed.prefix} imagen`, slug: `${seed.prefix}-img-${++counter}`, content, categoryIds: [], intent: "save", ...extra });
async function createWith(content: (url: string) => string, extra: Record<string, unknown> = {}) {
  const image = await upload();
  if (!image.ok) throw new Error(`No se pudo subir la imagen de prueba: ${image.message}`);
  const created = await performCreatePost(ctx(body(content(image.url), extra)));
  if (!created.ok) throw new Error(`No se pudo crear la entrada de prueba: ${created.message}`);
  return { id: created.id, slug: created.slug, url: image.url, name: nameOf(image.url), markdown: image.markdown };
}
const edit = (id: string, slug: string, content: string) => performUpdatePost(ctx({ id, title: `${seed.prefix} imagen`, slug, content, categoryIds: [], intent: "save" }));

describe("subir una imagen del contenido con la sesión del admin", () => {
  it("el archivo queda en el bucket con un nombre generado, se sirve por la URL pública y la línea de Markdown la apunta", async () => {
    const result = await upload("Luna llena");
    if (!result.ok) throw new Error(result.message);
    const name = nameOf(result.url);
    expect(name).toMatch(GENERATED);
    expect(result.url).toBe(`${testUrl()}/storage/v1/object/public/${BUCKET}/${name}`);
    expect(result.markdown).toBe(`![Luna llena](${result.url})`);
    expect(await servedAsImage(name)).toBe(true);
    expect((await bucketNames()).has(name)).toBe(true);
  });

  it("subir no crea ni modifica ninguna entrada", async () => {
    const { count: before } = await admin().from("posts").select("id", { count: "exact", head: true });
    await upload();
    const { count: after } = await admin().from("posts").select("id", { count: "exact", head: true });
    expect(after).toBe(before);
  });

  it("un nombre original peligroso se guarda con un nombre generado", async () => {
    const result = await upload("Alt", file(makePng(), "../../../etc/passwd.png"));
    if (!result.ok) throw new Error(result.message);
    expect(nameOf(result.url)).toMatch(GENERATED);
  });

  it("la entrada publicada con la imagen en el texto la devuelve la lectura pública sin sesión", async () => {
    const created = await createWith((url) => `Antes\n\n![Un texto](${url})\n\nDespués`, { intent: "publish" });
    const result = await getPublishedPost(anonClient(), created.slug, { origin: testUrl() });
    expect(result.status).toBe("ok");
    expect(result.status === "ok" && result.data.content).toContain(created.url);
  });
});

describe("lo que no es una imagen válida o no lleva texto alternativo no llega a Storage", () => {
  it.each([
    ["un SVG declarado como PNG", () => file(SVG), messages.COVER_INVALID_TYPE],
    ["un HTML renombrado .png", () => file(HTML), messages.COVER_INVALID_TYPE],
    ["un ejecutable renombrado .png", () => file(EXE), messages.COVER_INVALID_TYPE],
    ["un archivo vacío", () => file(new Uint8Array(0), "vacio.png"), messages.COVER_EMPTY],
    ["más de 2 MiB", () => file(makePngOfSize(2 * MIB + 1)), messages.COVER_TOO_LARGE],
  ])("%s", async (_caso, make, message) => {
    const before = await bucketNames();
    const result = await upload("Alt", make());
    expect(result).toMatchObject({ ok: false, fieldErrors: { image: message } });
    expect([...(await bucketNames())].sort()).toEqual([...before].sort());
  });

  it("sin texto alternativo no se sube nada", async () => {
    const before = await bucketNames();
    expect(await upload("   ")).toMatchObject({ ok: false, fieldErrors: { alt: messages.IMAGE_ALT_REQUIRED } });
    expect([...(await bucketNames())].sort()).toEqual([...before].sort());
  });
});

describe.each(UNPRIVILEGED)("A01: %s no puede subir imágenes", (role: Exclude<Role, "admin">) => {
  it("el servicio no sube nada y no devuelve URL", async () => {
    const before = await bucketNames();
    const result = await upload("Alt", file(makePng()), role);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("url");
    expect([...(await bucketNames())].sort()).toEqual([...before].sort());
  });

  it("directamente contra Storage: ni sube ni borra la imagen de una entrada", async () => {
    const created = await createWith((url) => `![Alt](${url})`, { intent: "publish" });
    const name = `${randomUUID()}.png`;
    uploaded.add(name);
    expect((await clientFor(role).storage.from(BUCKET).upload(name, makePng(), { contentType: "image/png" })).error).not.toBeNull();
    await clientFor(role).storage.from(BUCKET).remove([created.name]);
    expect(await servedAsImage(created.name)).toBe(true);
  });
});

describe("fallo simulado de Storage (A10)", () => {
  it("si la subida falla no hay URL, ni línea de Markdown, ni archivo, ni escritura en la base de datos", async () => {
    const real = admin();
    const failing = new Proxy(real, {
      get(target, property, receiver) {
        if (property !== "storage") return Reflect.get(target, property, receiver);
        return { from: () => ({ upload: async () => ({ data: null, error: { message: "fallo simulado 10.0.0.5" } }) }) };
      },
    });
    const before = await bucketNames();
    const result = await performUploadPostImage({ supabase: failing, userId: identityOf("admin").id, input: { image: file(makePng()), alt: "Alt" }, storageOrigin: testUrl() });
    expect(result).toEqual({ ok: false, message: messages.GENERIC_ERROR });
    expect([...(await bucketNames())].sort()).toEqual([...before].sort());
  });
});

describe("limpieza al editar y al eliminar (sin huérfanos en el texto guardado)", () => {
  it("quitar la línea de la imagen y guardar borra el archivo; la que se queda se sigue sirviendo", async () => {
    const first = await createWith((url) => `Texto\n\n![Uno](${url})`);
    const second = await upload("Dos");
    if (!second.ok) throw new Error(second.message);
    const withBoth = `Texto\n\n![Uno](${first.url})\n\n${second.markdown}`;
    expect(await edit(first.id, first.slug, withBoth)).toMatchObject({ ok: true });
    expect(await servedAsImage(first.name)).toBe(true);

    expect(await edit(first.id, first.slug, `Texto\n\n${second.markdown}`)).toMatchObject({ ok: true });
    expect(await servedAsImage(first.name)).toBe(false);
    expect((await bucketNames()).has(first.name)).toBe(false);
    expect(await servedAsImage(nameOf(second.url))).toBe(true);
  });

  it("no borra un archivo que otra entrada sigue usando", async () => {
    const shared = await createWith((url) => `![Compartida](${url})`);
    const other = await performCreatePost(ctx(body(`Otra\n\n${shared.markdown}`)));
    if (!other.ok) throw new Error(other.message);
    expect(await edit(shared.id, shared.slug, "Sin imágenes")).toMatchObject({ ok: true });
    expect(await servedAsImage(shared.name)).toBe(true);
  });

  it("eliminar la entrada borra las imágenes de su texto", async () => {
    const created = await createWith((url) => `Texto\n\n![Alt](${url})`, { intent: "publish" });
    const result = await performDeletePost(ctx({ id: created.id, confirm: "eliminar" }));
    expect(result).toMatchObject({ ok: true });
    expect(result).not.toHaveProperty("warning");
    expect(await servedAsImage(created.name)).toBe(false);
    expect((await bucketNames()).has(created.name)).toBe(false);
  });

  it("una imagen externa o con un nombre que no es el generado en el texto no provoca ningún borrado", async () => {
    const keep = await upload("No tocar");
    if (!keep.ok) throw new Error(keep.message);
    const hostile = `![x](https://evil.example/storage/v1/object/public/${BUCKET}/${nameOf(keep.url)})\n\n![y](${testUrl()}/storage/v1/object/public/${BUCKET}/portada.png)`;
    const created = await performCreatePost(ctx(body(hostile)));
    if (!created.ok) throw new Error(created.message);
    expect(await performDeletePost(ctx({ id: created.id, confirm: "eliminar" }))).toMatchObject({ ok: true });
    expect(await servedAsImage(nameOf(keep.url))).toBe(true);
  });
});
