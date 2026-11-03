import { beforeAll, describe, expect, it } from "vitest";
import * as messages from "@/lib/admin/messages";
import { performCreatePost, performDeletePost, performUpdatePost } from "@/lib/admin/posts/service";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { EXE, HTML, makePng, makePngOfSize, SVG, ascii, concat } from "../storage/images";
import { JPEG_BASELINE } from "../storage/real-images";
import {
  ADMIN_ID,
  CAT_A,
  category,
  createFake,
  draftPost,
  LEAK_PATTERN,
  LEAKY_ERROR,
  POST_DRAFT,
  POST_PUBLISHED,
  publishedPost,
  type FakeOptions,
} from "./support";

const NOW = new Date("2026-11-04T10:00:00.000Z");
const MIB = 1024 * 1024;
const GENERATED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const OLD_COVER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png";
const OLD_ALT = "Alt de la portada antigua";

beforeAll(() => {
  for (const key of Object.keys(COVER_MESSAGES)) expect(messages).toHaveProperty(key, expect.any(String));
});
const COVER_MESSAGES = {
  COVER_INVALID_TYPE: 1,
  COVER_CORRUPT: 1,
  COVER_EMPTY: 1,
  COVER_TOO_LARGE: 1,
  COVER_DIMENSIONS: 1,
  COVER_ALT_REQUIRED: 1,
  COVER_ALT_WITHOUT_COVER: 1,
  COVER_OLD_NOT_REMOVED: 1,
  COVER_NOT_REMOVED_ON_DELETE: 1,
  UPLOAD_RATE_LIMIT: 1,
};

const file = (bytes: Uint8Array, name = "portada.png", type = "image/png") => new File([new Uint8Array(bytes)], name, { type });
const valid = (extra: Record<string, unknown> = {}) => ({ title: "Mi entrada", slug: "", content: "Hola", categoryIds: [], intent: "save", ...extra });
const edit = (extra: Record<string, unknown> = {}) => valid({ id: POST_DRAFT, title: "Borrador uno", slug: "borrador-uno", content: "Texto del borrador", ...extra });
const editPublished = (extra: Record<string, unknown> = {}) => valid({ id: POST_PUBLISHED, title: "Publicada uno", slug: "publicada-uno", content: "Texto publicado", ...extra });

const withCover = (overrides: Record<string, unknown> = {}) => ({ cover_image_path: OLD_COVER, cover_alt: OLD_ALT, ...overrides });
const seeded = (options: FakeOptions = {}): FakeOptions => ({
  categories: [category(CAT_A, "Fuego", "fuego")],
  posts: [draftPost(), publishedPost(withCover())],
  storageObjects: [OLD_COVER],
  ...options,
});

type Limiter = ReturnType<typeof createRateLimiter>;
const create = (input: unknown, options: FakeOptions = {}, extra: { limiter?: Limiter; userId?: string } = {}) => {
  const fake = createFake({ categories: [category(CAT_A, "Fuego", "fuego")], ...options });
  return { fake, run: performCreatePost({ supabase: fake.client, userId: extra.userId ?? ADMIN_ID, input, now: NOW, limiter: extra.limiter }) };
};
const update = (input: unknown, options: FakeOptions = {}, extra: { limiter?: Limiter } = {}) => {
  const fake = createFake(seeded(options));
  return { fake, run: performUpdatePost({ supabase: fake.client, userId: ADMIN_ID, input, now: NOW, limiter: extra.limiter }) };
};
const remove = (input: unknown, options: FakeOptions = {}) => {
  const fake = createFake(seeded(options));
  return { fake, run: performDeletePost({ supabase: fake.client, userId: ADMIN_ID, input, now: NOW }) };
};
const removals = (fake: ReturnType<typeof createFake>) => fake.storage.log.filter((entry) => entry.op === "remove");
const uploads = (fake: ReturnType<typeof createFake>) => fake.storage.log.filter((entry) => entry.op === "upload");

describe("crear con portada", () => {
  it("sube el archivo, guarda ruta y texto alternativo y devuelve ok", async () => {
    const bytes = makePng();
    const { fake, run } = create(valid({ cover: file(bytes), coverAlt: "Luna llena" }));
    expect(await run).toMatchObject({ ok: true });
    const [row] = fake.posts;
    expect(row).toMatchObject({ cover_image_path: expect.stringMatching(GENERATED), cover_alt: "Luna llena" });
    expect(fake.storage.names).toEqual([row.cover_image_path]);
    expect(uploads(fake)).toEqual([{ op: "upload", bucket: "post-images", names: [row.cover_image_path], contentType: "image/png", upsert: false, size: bytes.length }]);
  });

  it("el tipo y la extensión salen del contenido, no del nombre ni del Content-Type declarado", async () => {
    const { fake, run } = create(valid({ cover: file(JPEG_BASELINE, "foto.svg", "image/png"), coverAlt: "Foto" }));
    await run;
    expect(fake.posts[0].cover_image_path).toMatch(/\.jpg$/);
    expect(uploads(fake)[0].contentType).toBe("image/jpeg");
  });

  it.each(["../../etc/passwd.png", "/etc/passwd", "..%2f..%2fx.png", "con espacios y ñ.png", "a\\b.png", `${"x".repeat(300)}.png`, "\u0000.png"])(
    "el nombre original %j no llega nunca a la ruta guardada",
    async (name) => {
      const { fake, run } = create(valid({ cover: file(makePng(), name), coverAlt: "Foto" }));
      const result = await run;
      expect(result).toMatchObject({ ok: true });
      expect(fake.posts[0].cover_image_path).toMatch(GENERATED);
      expect(JSON.stringify([result, fake.posts, fake.storage.log])).not.toMatch(/passwd|con espacios|xxxxxxxx/);
    },
  );

  it("una entrada sin portada no toca Storage ni envía columnas de portada", async () => {
    const { fake, run } = create(valid());
    await run;
    expect(fake.storage.log).toEqual([]);
    const [insert] = fake.writes.filter((entry) => entry.table === "posts" && entry.op === "insert");
    expect(Object.keys(insert.values as object)).not.toEqual(expect.arrayContaining(["cover_image_path"]));
    expect(Object.keys(insert.values as object)).not.toContain("cover_alt");
  });
});

describe("crear con portada: nada se sube si algo falla antes", () => {
  it("sin texto alternativo: error de campo y ni archivo ni fila", async () => {
    const { fake, run } = create(valid({ cover: file(makePng()), coverAlt: "" }));
    expect(await run).toMatchObject({ ok: false, fieldErrors: { coverAlt: messages.COVER_ALT_REQUIRED } });
    expect(fake.storage.log).toEqual([]);
    expect(fake.writes).toEqual([]);
  });

  it.each([
    ["un SVG declarado como PNG", () => file(SVG, "portada.png", "image/png"), messages.COVER_INVALID_TYPE],
    ["un HTML", () => file(HTML, "portada.png"), messages.COVER_INVALID_TYPE],
    ["un ejecutable renombrado .png", () => file(EXE, "portada.png"), messages.COVER_INVALID_TYPE],
    ["un archivo vacío", () => file(new Uint8Array(0), "vacio.png"), messages.COVER_EMPTY],
    ["un PNG cortado", () => file(makePng().slice(0, 40)), messages.COVER_CORRUPT],
    ["un PNG con un script detrás", () => file(concat(makePng(), ascii("<script>alert(1)</script>"))), messages.COVER_CORRUPT],
    ["más de 2 MiB", () => file(makePngOfSize(2 * MIB + 1)), messages.COVER_TOO_LARGE],
    ["unas dimensiones desmesuradas", () => file(makePng({ width: 9000, height: 9000 })), messages.COVER_DIMENSIONS],
  ])("%s: error de campo claro y nada subido ni escrito", async (_caso, make, message) => {
    const { fake, run } = create(valid({ cover: make(), coverAlt: "Alt" }));
    const result = await run;
    expect(result).toMatchObject({ ok: false, fieldErrors: { cover: message } });
    expect(fake.storage.log).toEqual([]);
    expect(fake.writes).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });

  it("2 MiB exactos se aceptan", async () => {
    const { fake, run } = create(valid({ cover: file(makePngOfSize(2 * MIB)), coverAlt: "Alt" }));
    expect(await run).toMatchObject({ ok: true });
    expect(uploads(fake)).toHaveLength(1);
  });

  it("una categoría inexistente se rechaza antes de subir nada", async () => {
    const { fake, run } = create(valid({ cover: file(makePng()), coverAlt: "Alt", categoryIds: ["33333333-3333-4333-8333-333333333333"] }));
    expect(await run).toMatchObject({ ok: false });
    expect(fake.storage.log).toEqual([]);
  });
});

describe("crear con portada: fallos a medias (A10)", () => {
  it("si falla la subida no queda fila y el error es genérico y sin detalles", async () => {
    const { fake, run } = create(valid({ cover: file(makePng()), coverAlt: "Alt" }), { storageFailures: [{ op: "upload" }] });
    const result = await run;
    expect(result).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
    expect(fake.posts).toEqual([]);
    expect(fake.storage.names).toEqual([]);
  });

  it("si la subida lanza una excepción, igual", async () => {
    const { fake, run } = create(valid({ cover: file(makePng()), coverAlt: "Alt" }), { storageFailures: [{ op: "upload", throws: true }] });
    expect(await run).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(fake.posts).toEqual([]);
  });

  it("si falla la escritura de la entrada tras subir, se borra el archivo subido", async () => {
    const { fake, run } = create(valid({ cover: file(makePng()), coverAlt: "Alt" }), { failures: [{ table: "posts", op: "insert", error: LEAKY_ERROR }] });
    const result = await run;
    expect(result).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
    expect(fake.posts).toEqual([]);
    expect(fake.storage.names).toEqual([]);
    expect(removals(fake)).toHaveLength(1);
  });

  it("si además falla el borrado del archivo, el resultado sigue siendo el error genérico y no lanza", async () => {
    const { fake, run } = create(valid({ cover: file(makePng()), coverAlt: "Alt" }), {
      failures: [{ table: "posts", op: "insert", error: LEAKY_ERROR }],
      storageFailures: [{ op: "remove" }],
    });
    expect(await run).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(fake.posts).toEqual([]);
  });

  it("si fallan las categorías tras crear, se borran la entrada y el archivo", async () => {
    const { fake, run } = create(valid({ cover: file(makePng()), coverAlt: "Alt", categoryIds: [CAT_A] }), { failures: [{ table: "post_categories", op: "insert", error: LEAKY_ERROR }] });
    expect(await run).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(fake.posts).toEqual([]);
    expect(fake.storage.names).toEqual([]);
  });

  it("un archivo con nombre que ya existe en el bucket no se sobrescribe (upsert: false)", async () => {
    const { fake, run } = create(valid({ cover: file(makePng()), coverAlt: "Alt" }));
    await run;
    expect(uploads(fake).every((entry) => entry.upsert === false)).toBe(true);
  });
});

describe("limitación de subidas", () => {
  const clock = () => {
    const state = { now: 1_000_000 };
    return { state, limiter: createRateLimiter({ limit: 2, windowMs: 600_000, now: () => state.now }) };
  };

  it("pasado el límite, la subida se bloquea sin tocar Storage ni escribir", async () => {
    const { limiter } = clock();
    for (let i = 0; i < 2; i++) await create(valid({ cover: file(makePng()), coverAlt: "Alt" }), {}, { limiter }).run;
    const blocked = create(valid({ cover: file(makePng()), coverAlt: "Alt" }), {}, { limiter });
    expect(await blocked.run).toMatchObject({ ok: false, message: messages.UPLOAD_RATE_LIMIT });
    expect(blocked.fake.storage.log).toEqual([]);
    expect(blocked.fake.writes).toEqual([]);
  });

  it("los intentos rechazados también cuentan", async () => {
    const { limiter } = clock();
    for (let i = 0; i < 2; i++) await create(valid({ cover: file(SVG), coverAlt: "Alt" }), {}, { limiter }).run;
    expect(await create(valid({ cover: file(makePng()), coverAlt: "Alt" }), {}, { limiter }).run).toMatchObject({ ok: false, message: messages.UPLOAD_RATE_LIMIT });
  });

  it("otro admin no se ve afectado y, pasada la ventana, se vuelve a poder subir", async () => {
    const { limiter, state } = clock();
    for (let i = 0; i < 2; i++) await create(valid({ cover: file(makePng()), coverAlt: "Alt" }), {}, { limiter }).run;
    expect(await create(valid({ cover: file(makePng()), coverAlt: "Alt" }), {}, { limiter, userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }).run).toMatchObject({ ok: true });
    state.now += 600_001;
    expect(await create(valid({ cover: file(makePng()), coverAlt: "Alt" }), {}, { limiter }).run).toMatchObject({ ok: true });
  });

  it("guardar sin archivo no cuenta como subida", async () => {
    const { limiter } = clock();
    for (let i = 0; i < 5; i++) expect(await create(valid(), {}, { limiter }).run).toMatchObject({ ok: true });
    expect(await create(valid({ cover: file(makePng()), coverAlt: "Alt" }), {}, { limiter }).run).toMatchObject({ ok: true });
  });
});

describe("editar: reemplazar la portada", () => {
  it("sube la nueva, actualiza ruta y alt y borra la antigua", async () => {
    const { fake, run } = update(editPublished({ cover: file(makePng()), coverAlt: "Alt nuevo" }));
    expect(await run).toMatchObject({ ok: true });
    const row = fake.postById(POST_PUBLISHED);
    expect(row).toMatchObject({ cover_image_path: expect.stringMatching(GENERATED), cover_alt: "Alt nuevo" });
    expect(row?.cover_image_path).not.toBe(OLD_COVER);
    expect(fake.storage.names).toEqual([row?.cover_image_path]);
  });

  it("la antigua se borra DESPUÉS de guardar: si falla la escritura, la antigua sigue y la nueva se retira", async () => {
    const { fake, run } = update(editPublished({ cover: file(makePng()), coverAlt: "Alt nuevo" }), { failures: [{ table: "posts", op: "update", error: LEAKY_ERROR }] });
    const result = await run;
    expect(result).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
    expect(fake.storage.names).toEqual([OLD_COVER]);
    expect(fake.postById(POST_PUBLISHED)).toMatchObject({ cover_image_path: OLD_COVER, cover_alt: OLD_ALT });
  });

  it("si falla la subida de la nueva, nada cambia y la antigua se conserva", async () => {
    const { fake, run } = update(editPublished({ cover: file(makePng()), coverAlt: "Alt nuevo" }), { storageFailures: [{ op: "upload" }] });
    expect(await run).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(fake.storage.names).toEqual([OLD_COVER]);
    expect(fake.writes).toEqual([]);
  });

  it("si falla el borrado de la antigua, la operación sale bien con un aviso y la fila apunta a la nueva", async () => {
    const { fake, run } = update(editPublished({ cover: file(makePng()), coverAlt: "Alt nuevo" }), { storageFailures: [{ op: "remove" }] });
    const result = await run;
    expect(result).toMatchObject({ ok: true, warning: messages.COVER_OLD_NOT_REMOVED });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
    expect(fake.postById(POST_PUBLISHED)?.cover_image_path).not.toBe(OLD_COVER);
  });

  it("subir una portada a una entrada que no tenía crea la ruta y no borra nada", async () => {
    const { fake, run } = update(edit({ cover: file(makePng()), coverAlt: "Primera portada" }));
    expect(await run).toMatchObject({ ok: true });
    expect(fake.postById(POST_DRAFT)).toMatchObject({ cover_image_path: expect.stringMatching(GENERIC_PATH), cover_alt: "Primera portada" });
    expect(removals(fake)).toEqual([]);
  });

  it("un archivo no válido o sin alt no sube nada ni cambia nada", async () => {
    for (const input of [editPublished({ cover: file(SVG), coverAlt: "Alt" }), editPublished({ cover: file(makePng()), coverAlt: "" })]) {
      const { fake, run } = update(input);
      expect(await run).toMatchObject({ ok: false });
      expect(fake.storage.log).toEqual([]);
      expect(fake.writes).toEqual([]);
    }
  });

  it("si la ruta guardada no es un nombre generado, no se intenta borrar nada en Storage", async () => {
    const { fake, run } = update(editPublished({ cover: file(makePng()), coverAlt: "Alt nuevo" }), { posts: [draftPost(), publishedPost(withCover({ cover_image_path: "../x.png" }))] });
    expect(await run).toMatchObject({ ok: true });
    expect(removals(fake).flatMap((entry) => entry.names)).not.toContain("../x.png");
  });

  it("las columnas de portada solo se envían cuando la portada cambia", async () => {
    const { fake, run } = update(editPublished({ cover: file(makePng()), coverAlt: "Alt nuevo" }));
    await run;
    const keys = fake.writes.filter((entry) => entry.table === "posts" && entry.op === "update").flatMap((entry) => Object.keys(entry.values as object)).sort();
    expect(keys).toEqual(["content_md", "cover_alt", "cover_image_path", "slug", "title"]);
  });
});

const GENERIC_PATH = GENERATED;

describe("editar: quitar la portada y cambiar solo el texto alternativo", () => {
  it("quitar deja ruta y alt a null y borra el archivo", async () => {
    const { fake, run } = update(editPublished({ removeCover: "on", coverAlt: OLD_ALT }));
    expect(await run).toMatchObject({ ok: true });
    expect(fake.postById(POST_PUBLISHED)).toMatchObject({ cover_image_path: null, cover_alt: null });
    expect(fake.storage.names).toEqual([]);
  });

  it("si falla el borrado del archivo al quitar, sale bien con un aviso", async () => {
    const { fake, run } = update(editPublished({ removeCover: "on", coverAlt: OLD_ALT }), { storageFailures: [{ op: "remove" }] });
    expect(await run).toMatchObject({ ok: true, warning: messages.COVER_OLD_NOT_REMOVED });
    expect(fake.postById(POST_PUBLISHED)?.cover_image_path).toBeNull();
  });

  it("si falla la escritura al quitar, el archivo no se borra", async () => {
    const { fake, run } = update(editPublished({ removeCover: "on", coverAlt: OLD_ALT }), { failures: [{ table: "posts", op: "update", error: LEAKY_ERROR }] });
    expect(await run).toMatchObject({ ok: false });
    expect(fake.storage.names).toEqual([OLD_COVER]);
  });

  it("quitar una portada que no existe no hace nada en Storage ni toca columnas de portada", async () => {
    const { fake, run } = update(edit({ removeCover: "on" }));
    expect(await run).toMatchObject({ ok: true });
    expect(fake.storage.log).toEqual([]);
    const keys = fake.writes.filter((entry) => entry.table === "posts").flatMap((entry) => Object.keys(entry.values as object));
    expect(keys).not.toContain("cover_image_path");
  });

  it("cambiar solo el alt actualiza únicamente cover_alt y no toca Storage", async () => {
    const { fake, run } = update(editPublished({ coverAlt: "Texto nuevo" }));
    expect(await run).toMatchObject({ ok: true });
    expect(fake.postById(POST_PUBLISHED)).toMatchObject({ cover_image_path: OLD_COVER, cover_alt: "Texto nuevo" });
    expect(fake.storage.log).toEqual([]);
    const keys = fake.writes.filter((entry) => entry.table === "posts").flatMap((entry) => Object.keys(entry.values as object)).sort();
    expect(keys).toEqual(["content_md", "cover_alt", "slug", "title"]);
  });

  it("una entrada con portada no admite un alt vacío al guardarla", async () => {
    const { fake, run } = update(editPublished({ coverAlt: "" }));
    expect(await run).toMatchObject({ ok: false, fieldErrors: { coverAlt: messages.COVER_ALT_REQUIRED } });
    expect(fake.writes).toEqual([]);
  });

  it("un alt en una entrada sin portada es un error de campo", async () => {
    const { fake, run } = update(edit({ coverAlt: "Sin portada" }));
    expect(await run).toMatchObject({ ok: false, fieldErrors: { coverAlt: messages.COVER_ALT_WITHOUT_COVER } });
    expect(fake.writes).toEqual([]);
  });

  it("guardar una entrada sin portada y sin campos de portada no toca Storage (columnas exactas, como en el bloque 3)", async () => {
    const { fake, run } = update(edit());
    await run;
    expect(fake.storage.log).toEqual([]);
    const keys = fake.writes.filter((entry) => entry.table === "posts").flatMap((entry) => Object.keys(entry.values as object)).sort();
    expect(keys).toEqual(["content_md", "slug", "title"]);
  });
});

describe("eliminar la entrada", () => {
  it("borra la fila y también su portada", async () => {
    const { fake, run } = remove({ id: POST_PUBLISHED, confirm: "eliminar" });
    expect(await run).toMatchObject({ ok: true });
    expect(fake.postById(POST_PUBLISHED)).toBeUndefined();
    expect(fake.storage.names).toEqual([]);
  });

  it("si falla el borrado del archivo, la entrada se elimina igualmente y se avisa", async () => {
    const { fake, run } = remove({ id: POST_PUBLISHED, confirm: "eliminar" }, { storageFailures: [{ op: "remove" }] });
    const result = await run;
    expect(result).toMatchObject({ ok: true, warning: messages.COVER_NOT_REMOVED_ON_DELETE });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
    expect(fake.postById(POST_PUBLISHED)).toBeUndefined();
  });

  it("si falla el borrado de la fila, la portada no se toca (nunca una ruta rota)", async () => {
    const { fake, run } = remove({ id: POST_PUBLISHED, confirm: "eliminar" }, { failures: [{ table: "posts", op: "delete", error: LEAKY_ERROR }] });
    expect(await run).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(fake.storage.names).toEqual([OLD_COVER]);
    expect(fake.storage.log).toEqual([]);
  });

  it("una entrada sin portada no toca Storage", async () => {
    const { fake, run } = remove({ id: POST_DRAFT, confirm: "eliminar" });
    expect(await run).toMatchObject({ ok: true });
    expect(fake.storage.log).toEqual([]);
  });

  it("una ruta que no es un nombre generado no se pasa a Storage", async () => {
    const { fake, run } = remove({ id: POST_PUBLISHED, confirm: "eliminar" }, { posts: [draftPost(), publishedPost(withCover({ cover_image_path: "../x.png" }))] });
    expect(await run).toMatchObject({ ok: true });
    expect(removals(fake).flatMap((entry) => entry.names)).not.toContain("../x.png");
  });

  it("sin la confirmación no se borra ni la fila ni el archivo", async () => {
    const { fake, run } = remove({ id: POST_PUBLISHED });
    expect(await run).toMatchObject({ ok: false });
    expect(fake.storage.log).toEqual([]);
    expect(fake.postById(POST_PUBLISHED)).toBeDefined();
  });
});
