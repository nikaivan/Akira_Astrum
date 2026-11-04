import { beforeAll, describe, expect, it } from "vitest";
import * as messages from "@/lib/admin/messages";
import { performUploadPostImage } from "@/lib/admin/posts/image-service";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { EXE, HTML, makePng, makePngOfSize, SVG, ascii, concat } from "../storage/images";
import { JPEG_BASELINE } from "../storage/real-images";
import { ADMIN_ID, createFake, LEAK_PATTERN, LEAKY_ERROR, type FakeOptions } from "./support";

const ORIGIN = "https://proyecto.supabase.co";
const BASE = `${ORIGIN}/storage/v1/object/public/post-images/`;
const MIB = 1024 * 1024;
const GENERATED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

// Los mensajes nuevos deben existir: si no, las comparaciones de abajo serían `undefined === undefined`.
beforeAll(() => {
  for (const key of ["IMAGE_FILE_REQUIRED", "IMAGE_ALT_REQUIRED", "IMAGE_ALT_INVALID"]) expect(messages).toHaveProperty(key, expect.any(String));
  expect(new Set([messages.IMAGE_FILE_REQUIRED, messages.IMAGE_ALT_REQUIRED, messages.IMAGE_ALT_INVALID]).size).toBe(3);
});

const file = (bytes: Uint8Array, name = "imagen.png", type = "image/png") => new File([new Uint8Array(bytes)], name, { type });
const valid = (extra: Record<string, unknown> = {}) => ({ image: file(makePng()), alt: "Luna llena", ...extra });

type Limiter = ReturnType<typeof createRateLimiter>;
function upload(input: unknown, options: FakeOptions = {}, extra: { limiter?: Limiter; storageOrigin?: string | null } = {}) {
  const fake = createFake(options);
  const storageOrigin = "storageOrigin" in extra ? extra.storageOrigin : ORIGIN;
  return { fake, run: performUploadPostImage({ supabase: fake.client, userId: ADMIN_ID, input, limiter: extra.limiter, storageOrigin }) };
}
const uploads = (fake: ReturnType<typeof createFake>) => fake.storage.log.filter((entry) => entry.op === "upload");
const nothingHappened = (fake: ReturnType<typeof createFake>) => {
  expect(fake.storage.log).toEqual([]);
  expect(fake.writes).toEqual([]);
  expect(fake.touchedData).toEqual([]);
};

describe("subir una imagen para el contenido", () => {
  it("sube el archivo con un nombre generado y devuelve la URL pública y la línea de Markdown", async () => {
    const bytes = makePng();
    const { fake, run } = upload(valid({ image: file(bytes) }));
    const result = await run;
    expect(result).toMatchObject({ ok: true });
    const [entry] = uploads(fake);
    expect(entry).toMatchObject({ bucket: "post-images", contentType: "image/png", upsert: false, size: bytes.length });
    expect(entry.names[0]).toMatch(GENERATED);
    expect(fake.storage.names).toEqual(entry.names);
    if (!result.ok) throw new Error("no debería fallar");
    expect(result.url).toBe(`${BASE}${entry.names[0]}`);
    expect(result.alt).toBe("Luna llena");
    expect(result.markdown).toBe(`![Luna llena](${BASE}${entry.names[0]})`);
  });

  it("no escribe nada en la base de datos: la imagen solo existe en el contenido que el admin guarde", async () => {
    const { fake, run } = upload(valid());
    await run;
    expect(fake.writes).toEqual([]);
  });

  it("el tipo y la extensión salen del contenido, no del nombre ni del Content-Type declarado", async () => {
    const { fake, run } = upload(valid({ image: file(JPEG_BASELINE, "foto.svg", "image/png") }));
    await run;
    expect(uploads(fake)[0].names[0]).toMatch(/\.jpg$/);
    expect(uploads(fake)[0].contentType).toBe("image/jpeg");
  });

  it.each(["../../etc/passwd.png", "/etc/passwd", "..%2f..%2fx.png", "con espacios y ñ.png", "a\\b.png", `${"x".repeat(300)}.png`, "\u0000.png"])(
    "el nombre original %j no llega nunca a la ruta, a la URL ni a la respuesta",
    async (name) => {
      const { fake, run } = upload(valid({ image: file(makePng(), name) }));
      const result = await run;
      expect(result).toMatchObject({ ok: true });
      expect(uploads(fake)[0].names[0]).toMatch(GENERATED);
      expect(JSON.stringify([result, fake.storage.log])).not.toMatch(/passwd|con espacios|xxxxxxxx/);
    },
  );

  it("cada subida recibe un nombre distinto", async () => {
    const fake = createFake();
    const run = () => performUploadPostImage({ supabase: fake.client, userId: ADMIN_ID, input: valid(), storageOrigin: ORIGIN });
    await run();
    await run();
    const names = uploads(fake).flatMap((entry) => entry.names);
    expect(new Set(names).size).toBe(2);
  });

  it("el texto alternativo se recorta y se escribe escapado en la línea", async () => {
    const { run } = upload(valid({ alt: "  Un [gato] \\ dormido  " }));
    const result = await run;
    if (!result.ok) throw new Error("no debería fallar");
    expect(result.alt).toBe("Un [gato] \\ dormido");
    expect(result.markdown).toMatch(/^!\[Un \\\[gato\\\] \\\\ dormido\]\(/);
  });

  it("acepta un texto alternativo de exactamente 200 caracteres", async () => {
    const { run } = upload(valid({ alt: "a".repeat(200) }));
    expect(await run).toMatchObject({ ok: true });
  });
});

describe("el texto alternativo es obligatorio: sin él no se sube ni se inserta nada", () => {
  it.each([
    ["vacío", { alt: "" }],
    ["solo espacios", { alt: "   \t " }],
    ["ausente", { alt: undefined }],
  ])("alt %s: error de campo y nada subido", async (_caso, change) => {
    const input: Record<string, unknown> = { ...valid(), ...change };
    if (change.alt === undefined) delete input.alt;
    const { fake, run } = upload(input);
    const result = await run;
    expect(result).toMatchObject({ ok: false, fieldErrors: { alt: messages.IMAGE_ALT_REQUIRED } });
    expect(result).not.toHaveProperty("markdown");
    expect(result).not.toHaveProperty("url");
    nothingHappened(fake);
  });

  it.each([
    ["más de 200 caracteres", "a".repeat(201)],
    ["un salto de línea", "una\nlínea"],
    ["un carácter de control", "a\u0000b"],
    ["un retorno de carro", "a\rb"],
  ])("alt con %s: error de campo y nada subido", async (_caso, alt) => {
    const { fake, run } = upload(valid({ alt }));
    expect(await run).toMatchObject({ ok: false, fieldErrors: { alt: messages.IMAGE_ALT_INVALID } });
    nothingHappened(fake);
  });

  it("un texto alternativo que no es texto se rechaza", async () => {
    const { fake, run } = upload(valid({ alt: file(makePng()) }));
    expect(await run).toMatchObject({ ok: false });
    nothingHappened(fake);
  });
});

describe("el archivo: mismas reglas que la portada, validadas por su contenido", () => {
  it.each([
    ["un SVG declarado como PNG", () => file(SVG, "x.png", "image/png"), messages.COVER_INVALID_TYPE],
    ["un HTML", () => file(HTML, "x.png"), messages.COVER_INVALID_TYPE],
    ["un ejecutable renombrado .png", () => file(EXE, "x.png"), messages.COVER_INVALID_TYPE],
    ["un archivo vacío con nombre", () => file(new Uint8Array(0), "vacio.png"), messages.COVER_EMPTY],
    ["un PNG cortado", () => file(makePng().slice(0, 40)), messages.COVER_CORRUPT],
    ["un PNG con un script detrás", () => file(concat(makePng(), ascii("<script>alert(1)</script>"))), messages.COVER_CORRUPT],
    ["más de 2 MiB", () => file(makePngOfSize(2 * MIB + 1)), messages.COVER_TOO_LARGE],
    ["unas dimensiones desmesuradas", () => file(makePng({ width: 9000, height: 9000 })), messages.COVER_DIMENSIONS],
  ])("%s: error de campo claro y nada subido", async (_caso, make, message) => {
    const { fake, run } = upload(valid({ image: make() }));
    const result = await run;
    expect(result).toMatchObject({ ok: false, fieldErrors: { image: message } });
    expect(result).not.toHaveProperty("markdown");
    nothingHappened(fake);
  });

  it("exactamente 2 MiB se acepta", async () => {
    const { fake, run } = upload(valid({ image: file(makePngOfSize(2 * MIB)) }));
    expect(await run).toMatchObject({ ok: true });
    expect(uploads(fake)).toHaveLength(1);
  });

  it.each([
    ["sin campo de archivo", () => ({ alt: "Luna" })],
    ["un campo de archivo vacío con el nombre «undefined» (sin elegir)", () => ({ alt: "Luna", image: new File([], "undefined") })],
    ["un campo de archivo vacío sin nombre", () => ({ alt: "Luna", image: new File([], "") })],
    ["un texto en lugar de un archivo", () => ({ alt: "Luna", image: "no soy un archivo" })],
  ])("%s: pide elegir una imagen y no sube nada", async (_caso, make) => {
    const { fake, run } = upload(make());
    expect(await run).toMatchObject({ ok: false, fieldErrors: { image: messages.IMAGE_FILE_REQUIRED } });
    nothingHappened(fake);
  });
});

describe("solo se admiten los campos acordados (A05: sin asignación masiva)", () => {
  it.each([
    ["cover_image_path", "../x.png"],
    ["author_id", "cualquiera"],
    ["bucket", "otro-bucket"],
    ["path", "carpeta/x.png"],
    ["name", "x.png"],
    ["upsert", "true"],
    ["__proto__", "x"],
  ])("un campo extra (%s) rechaza toda la petición", async (key, value) => {
    const input = Object.fromEntries([...Object.entries(valid()), [key, value]]);
    const { fake, run } = upload(input);
    expect(await run).toMatchObject({ ok: false });
    nothingHappened(fake);
  });

  it("dos archivos en la misma petición se rechazan", async () => {
    const { fake, run } = upload({ ...valid(), image: [file(makePng()), file(makePng())] });
    expect(await run).toMatchObject({ ok: false });
    nothingHappened(fake);
  });

  it.each([null, undefined, "texto", 7, []])("una entrada que no es un objeto (%j) se rechaza", async (input) => {
    const { fake, run } = upload(input);
    expect(await run).toMatchObject({ ok: false });
    nothingHappened(fake);
  });
});

describe("falla cerrado (A10): si algo va mal no hay URL ni línea para insertar", () => {
  it.each([
    ["Storage devuelve un error", { storageFailures: [{ op: "upload" as const, error: LEAKY_ERROR }] }],
    ["Storage lanza una excepción", { storageFailures: [{ op: "upload" as const, throws: true }] }],
  ])("%s", async (_caso, options) => {
    const { fake, run } = upload(valid(), options);
    const result = await run;
    expect(result).toEqual({ ok: false, message: messages.GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
    expect(fake.storage.names).toEqual([]);
    expect(fake.writes).toEqual([]);
  });

  it.each([null, undefined, "", "no es una url", "http://proyecto.supabase.co", "https://usuario@proyecto.supabase.co"])(
    "sin un origen de Storage https limpio (%j) no sube nada: la imagen no se podría mostrar",
    async (storageOrigin) => {
      const { fake, run } = upload(valid(), {}, { storageOrigin });
      expect(await run).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
      expect(fake.storage.log).toEqual([]);
    },
  );

  it("ningún mensaje de error contiene detalles internos", async () => {
    const results = await Promise.all([
      upload(valid({ alt: "" })).run,
      upload(valid({ image: file(SVG) })).run,
      upload(valid({ image: file(makePngOfSize(2 * MIB + 1)) })).run,
      upload(valid(), { storageFailures: [{ op: "upload", error: LEAKY_ERROR }] }).run,
    ]);
    expect(JSON.stringify(results)).not.toMatch(LEAK_PATTERN);
  });
});

describe("límite de subidas (comparte el de las portadas)", () => {
  it("cada intento cuenta, también los rechazados, y al llegar al límite se bloquea antes de leer el archivo", async () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => now });
    const first = upload(valid({ image: file(SVG) }), {}, { limiter });
    expect(await first.run).toMatchObject({ ok: false, fieldErrors: { image: messages.COVER_INVALID_TYPE } });
    expect(await upload(valid(), {}, { limiter }).run).toMatchObject({ ok: true });

    const blocked = upload(valid(), {}, { limiter });
    expect(await blocked.run).toEqual({ ok: false, message: messages.UPLOAD_RATE_LIMIT });
    expect(blocked.fake.storage.log).toEqual([]);

    now += 61_000;
    expect(await upload(valid(), {}, { limiter }).run).toMatchObject({ ok: true });
  });

  it("un intento sin texto alternativo no gasta cupo ni sube nada", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(await upload(valid({ alt: "" }), {}, { limiter }).run).toMatchObject({ ok: false });
    expect(await upload(valid(), {}, { limiter }).run).toMatchObject({ ok: true });
  });
});
