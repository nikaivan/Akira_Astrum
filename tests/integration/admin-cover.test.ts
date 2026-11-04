import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as messages from "@/lib/admin/messages";
import { performCreatePost, performDeletePost, performUpdatePost } from "@/lib/admin/posts/service";
import { getPublishedPost } from "@/lib/blog/queries";
import { EXE, makePng, makePngOfSize, SVG } from "../unit/storage/images";
import { anonClient, clientFor, expectDenied, identityOf, testUrl, UNPRIVILEGED, type Role } from "./support/api";
import { removeStorageObjects, seedContent, type Seed } from "./support/service-role";

/**
 * La portada contra la API real del proyecto de TEST (Storage, RLS, CHECK y privilegios de columna de verdad).
 * Se usan los mismos `perform*` que las Server Actions con la sesión del admin de prueba. Cada test borra lo que sube.
 */

const BUCKET = "post-images";
const MIB = 1024 * 1024;
const GENERATED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

let seed: Seed;
const uploaded = new Set<string>();

beforeAll(async () => {
  seed = await seedContent("cover");
});
afterAll(async () => {
  await removeStorageObjects([...uploaded]);
  await seed?.cleanup();
});

const admin = () => clientFor("admin");
const ctx = (input: unknown) => ({ supabase: admin(), userId: identityOf("admin").id, input, now: new Date() });
const file = (bytes: Uint8Array, name = "portada.png", type = "image/png") => new File([new Uint8Array(bytes)], name, { type });

let counter = 0;
const slug = (label: string) => `${seed.prefix}-${label}-${++counter}`;
const body = (extra: Record<string, unknown> = {}) => ({ title: `${seed.prefix} portada`, slug: slug("p"), content: "Contenido", categoryIds: [], intent: "save", ...extra });

async function rowOf(id: string) {
  const { data, error } = await admin().from("posts").select("id, slug, status, cover_image_path, cover_alt").eq("id", id).single();
  expect(error).toBeNull();
  return data as { id: string; slug: string; status: string; cover_image_path: string | null; cover_alt: string | null };
}
const bucketNames = async () => {
  const { data, error } = await admin().storage.from(BUCKET).list(undefined, { limit: 1000 });
  expect(error).toBeNull();
  return new Set((data ?? []).map((object) => object.name));
};
const publicUrl = (name: string) => `${anonClient().storage.from(BUCKET).getPublicUrl(name).data.publicUrl}?t=${randomUUID()}`;
const servedAsImage = async (name: string) => {
  const response = await fetch(publicUrl(name));
  return response.status === 200 && (response.headers.get("content-type") ?? "").startsWith("image/");
};

async function createWithCover(extra: Record<string, unknown> = {}) {
  const result = await performCreatePost(ctx(body({ cover: file(makePng({ width: 16, height: 16 })), coverAlt: "Texto alternativo de prueba", ...extra })));
  if (!result.ok) throw new Error(`No se pudo crear la entrada de prueba: ${result.message}`);
  const row = await rowOf(result.id);
  if (row.cover_image_path) uploaded.add(row.cover_image_path);
  return row;
}

describe("subir una portada con la sesión del admin", () => {
  it("el archivo queda en el bucket con un nombre generado, se sirve por la URL pública y la fila guarda ruta y alt", async () => {
    const row = await createWithCover();
    expect(row.cover_image_path).toMatch(GENERATED);
    expect(row.cover_alt).toBe("Texto alternativo de prueba");
    const response = await fetch(publicUrl(row.cover_image_path as string));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect((await bucketNames()).has(row.cover_image_path as string)).toBe(true);
  });

  it("la lectura pública devuelve la URL y el texto alternativo de una entrada publicada, sin sesión", async () => {
    const row = await createWithCover({ intent: "publish" });
    const result = await getPublishedPost(anonClient(), row.slug, { origin: testUrl() });
    expect(result.status).toBe("ok");
    expect(result.status === "ok" && result.data.coverAlt).toBe("Texto alternativo de prueba");
    expect(result.status === "ok" && result.data.coverUrl).toContain(row.cover_image_path as string);
  });

  it("un archivo con un nombre original peligroso se guarda con un nombre generado", async () => {
    const row = await createWithCover({ cover: file(makePng(), "../../../etc/passwd.png") });
    expect(row.cover_image_path).toMatch(GENERATED);
  });
});

describe("lo que no es una imagen válida no llega a Storage", () => {
  it.each([
    ["un SVG declarado como PNG", () => file(SVG), messages.COVER_INVALID_TYPE],
    ["un ejecutable renombrado .png", () => file(EXE), messages.COVER_INVALID_TYPE],
    ["un archivo vacío", () => file(new Uint8Array(0), "vacio.png"), messages.COVER_EMPTY],
    ["más de 2 MiB", () => file(makePngOfSize(2 * MIB + 1)), messages.COVER_TOO_LARGE],
  ])("%s", async (_caso, make, message) => {
    const before = await bucketNames();
    const result = await performCreatePost(ctx(body({ cover: make(), coverAlt: "Alt" })));
    expect(result).toMatchObject({ ok: false, fieldErrors: { cover: message } });
    expect([...(await bucketNames())].sort()).toEqual([...before].sort());
  });

  it("sin texto alternativo no se sube nada ni se crea la entrada", async () => {
    const before = await bucketNames();
    const input = body({ cover: file(makePng()), coverAlt: "" });
    const result = await performCreatePost(ctx(input));
    expect(result).toMatchObject({ ok: false, fieldErrors: { coverAlt: messages.COVER_ALT_REQUIRED } });
    expect([...(await bucketNames())].sort()).toEqual([...before].sort());
    const { data } = await admin().from("posts").select("id").eq("slug", input.slug);
    expect(data).toEqual([]);
  });
});

describe("reemplazar, quitar y eliminar borran el archivo (sin huérfanos)", () => {
  it("reemplazar: la nueva se sirve y la antigua deja de servirse", async () => {
    const row = await createWithCover();
    const old = row.cover_image_path as string;
    const result = await performUpdatePost(ctx({ id: row.id, title: `${seed.prefix} portada`, slug: row.slug, content: "Contenido", categoryIds: [], intent: "save", cover: file(makePng({ width: 20, height: 20 })), coverAlt: "Otro texto" }));
    expect(result).toMatchObject({ ok: true });
    const after = await rowOf(row.id);
    uploaded.add(after.cover_image_path as string);
    expect(after.cover_image_path).not.toBe(old);
    expect(after.cover_alt).toBe("Otro texto");
    expect(await servedAsImage(after.cover_image_path as string)).toBe(true);
    expect(await servedAsImage(old)).toBe(false);
    expect((await bucketNames()).has(old)).toBe(false);
  });

  it("quitar: la fila queda sin portada ni alt y el archivo desaparece", async () => {
    const row = await createWithCover();
    const result = await performUpdatePost(ctx({ id: row.id, title: `${seed.prefix} portada`, slug: row.slug, content: "Contenido", categoryIds: [], intent: "save", removeCover: "on" }));
    expect(result).toMatchObject({ ok: true });
    expect(await rowOf(row.id)).toMatchObject({ cover_image_path: null, cover_alt: null });
    expect(await servedAsImage(row.cover_image_path as string)).toBe(false);
  });

  it("cambiar solo el texto alternativo no toca el archivo", async () => {
    const row = await createWithCover();
    const result = await performUpdatePost(ctx({ id: row.id, title: `${seed.prefix} portada`, slug: row.slug, content: "Contenido", categoryIds: [], intent: "save", coverAlt: "Texto corregido" }));
    expect(result).toMatchObject({ ok: true });
    expect(await rowOf(row.id)).toMatchObject({ cover_image_path: row.cover_image_path, cover_alt: "Texto corregido" });
    expect(await servedAsImage(row.cover_image_path as string)).toBe(true);
  });

  it("eliminar la entrada borra también su portada", async () => {
    const row = await createWithCover({ intent: "publish" });
    const result = await performDeletePost(ctx({ id: row.id, confirm: "eliminar" }));
    expect(result).toMatchObject({ ok: true });
    const { data } = await admin().from("posts").select("id").eq("id", row.id);
    expect(data).toEqual([]);
    expect(await servedAsImage(row.cover_image_path as string)).toBe(false);
    expect((await bucketNames()).has(row.cover_image_path as string)).toBe(false);
  });
});

describe("fallo simulado de la escritura en la base de datos (A10)", () => {
  it("si la entrada no se puede escribir tras subir la imagen, no queda ni fila ni archivo", async () => {
    const real = admin();
    const failing = new Proxy(real, {
      get(target, property, receiver) {
        if (property !== "from") return Reflect.get(target, property, receiver);
        return (table: string) =>
          table === "posts"
            ? { insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: "XX000", message: "fallo simulado" } }) }) }) }
            : target.from(table);
      },
    });
    const before = await bucketNames();
    const input = body({ cover: file(makePng()), coverAlt: "Alt" });
    const result = await performCreatePost({ supabase: failing, userId: identityOf("admin").id, input, now: new Date() });
    expect(result).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect([...(await bucketNames())].sort()).toEqual([...before].sort());
    const { data } = await admin().from("posts").select("id").eq("slug", input.slug);
    expect(data).toEqual([]);
  });
});

describe.each(UNPRIVILEGED)("A01: %s no puede subir, reemplazar ni borrar portadas", (role: Exclude<Role, "admin">) => {
  const who = () => ({ supabase: clientFor(role), userId: role === "anon" ? randomUUID() : identityOf(role).id, now: new Date() });

  it("los servicios no suben, no escriben y no borran nada", async () => {
    const row = await createWithCover({ intent: "publish" });
    const before = await bucketNames();
    const attempts = await Promise.all([
      performCreatePost({ ...who(), input: body({ cover: file(makePng()), coverAlt: "Alt" }) }),
      performUpdatePost({ ...who(), input: { id: row.id, title: "Hackeado", slug: row.slug, content: "x", categoryIds: [], intent: "save", cover: file(makePng()), coverAlt: "Alt" } }),
      performUpdatePost({ ...who(), input: { id: row.id, title: "Hackeado", slug: row.slug, content: "x", categoryIds: [], intent: "save", removeCover: "on" } }),
      performDeletePost({ ...who(), input: { id: row.id, confirm: "eliminar" } }),
    ]);
    for (const attempt of attempts) expect(attempt.ok).toBe(false);
    expect([...(await bucketNames())].sort()).toEqual([...before].sort());
    expect(await rowOf(row.id)).toMatchObject({ cover_image_path: row.cover_image_path, cover_alt: row.cover_alt, status: "published" });
    expect(await servedAsImage(row.cover_image_path as string)).toBe(true);
  });

  it("directamente contra Storage: ni sube ni borra la portada de una entrada", async () => {
    const row = await createWithCover();
    const name = `${randomUUID()}.png`;
    uploaded.add(name);
    const up = await clientFor(role).storage.from(BUCKET).upload(name, makePng(), { contentType: "image/png" });
    expect(up.error).not.toBeNull();
    await clientFor(role).storage.from(BUCKET).remove([row.cover_image_path as string]);
    expect(await servedAsImage(row.cover_image_path as string)).toBe(true);
  });

  it("la lectura pública de la imagen sigue funcionando", async () => {
    const row = await createWithCover({ intent: "publish" });
    expect(await servedAsImage(row.cover_image_path as string)).toBe(true);
  });
});

describe("columna cover_alt (migración 20261104000000)", () => {
  it("la longitud se comprueba en la base de datos: vacío y 201 caracteres se rechazan; 200 se acepta", async () => {
    const row = await createWithCover();
    for (const bad of ["", "a".repeat(201)]) {
      const { error } = await admin().from("posts").update({ cover_alt: bad }).eq("id", row.id).select();
      expect(error?.code).toBe("23514");
    }
    const ok = await admin().from("posts").update({ cover_alt: "a".repeat(200) }).eq("id", row.id).select();
    expect(ok.error).toBeNull();
  });

  it.each(UNPRIVILEGED)("%s no puede actualizarla", async (role) => {
    const row = await createWithCover();
    expectDenied(await clientFor(role).from("posts").update({ cover_alt: "Hackeado" }).eq("id", row.id).select());
    expect((await rowOf(row.id)).cover_alt).toBe("Texto alternativo de prueba");
  });

  it("el admin puede dejarla a null junto con la ruta (quitar la portada)", async () => {
    const row = await createWithCover();
    const { error } = await admin().from("posts").update({ cover_image_path: null, cover_alt: null }).eq("id", row.id).select();
    expect(error).toBeNull();
  });
});
