import { describe, expect, it } from "vitest";
import { COVER_BUCKET, generateCoverName, removeCoverFile, uploadCover } from "@/lib/storage/covers";
import { validateImage } from "@/lib/storage/image-validation";
import { createFake, LEAK_PATTERN } from "../admin/support";
import { makePng } from "./images";
import { JPEG_BASELINE, WEBP_LOSSY } from "./real-images";

const GENERATED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

function validated(bytes: Uint8Array) {
  const image = validateImage(bytes);
  if (!image.ok) throw new Error("la imagen de prueba debería ser válida");
  return image;
}

describe("generateCoverName", () => {
  it("es un UUID con la extensión pedida", () => {
    for (const extension of ["jpg", "png", "webp"] as const) expect(generateCoverName(extension)).toMatch(new RegExp(`^[0-9a-f-]{36}\\.${extension}$`));
    expect(generateCoverName("png")).toMatch(GENERATED);
  });

  it("no se repite", () => {
    expect(new Set(Array.from({ length: 200 }, () => generateCoverName("png"))).size).toBe(200);
  });
});

describe("uploadCover", () => {
  it("sube al bucket de imágenes con un nombre generado y el tipo detectado, sin sobrescribir", async () => {
    const fake = createFake();
    const bytes = makePng();
    const result = await uploadCover(fake.client, bytes, validated(bytes));
    expect(result).toMatchObject({ ok: true, path: expect.stringMatching(GENERATED) });
    expect(COVER_BUCKET).toBe("post-images");
    expect(fake.storage.log).toEqual([{ op: "upload", bucket: "post-images", names: [(result as { path: string }).path], contentType: "image/png", upsert: false, size: bytes.length }]);
    expect(fake.storage.names).toEqual([(result as { path: string }).path]);
  });

  it("la extensión y el tipo salen del contenido (JPEG y WebP)", async () => {
    const fake = createFake();
    const jpeg = await uploadCover(fake.client, JPEG_BASELINE, validated(JPEG_BASELINE));
    const webp = await uploadCover(fake.client, WEBP_LOSSY, validated(WEBP_LOSSY));
    expect(jpeg).toMatchObject({ ok: true, path: expect.stringMatching(/\.jpg$/) });
    expect(webp).toMatchObject({ ok: true, path: expect.stringMatching(/\.webp$/) });
    expect(fake.storage.log.map((entry) => entry.contentType)).toEqual(["image/jpeg", "image/webp"]);
  });

  it("un fallo de Storage devuelve { ok: false } sin filtrar nada", async () => {
    const fake = createFake({ storageFailures: [{ op: "upload" }] });
    const result = await uploadCover(fake.client, makePng(), validated(makePng()));
    expect(result).toEqual({ ok: false });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });

  it("una excepción de red tampoco sale: { ok: false }", async () => {
    const fake = createFake({ storageFailures: [{ op: "upload", throws: true }] });
    expect(await uploadCover(fake.client, makePng(), validated(makePng()))).toEqual({ ok: false });
  });
});

describe("removeCoverFile", () => {
  it("borra un archivo con nombre generado", async () => {
    const name = generateCoverName("png");
    const fake = createFake({ storageObjects: [name] });
    expect(await removeCoverFile(fake.client, name)).toBe(true);
    expect(fake.storage.names).toEqual([]);
    expect(fake.storage.log).toEqual([{ op: "remove", bucket: "post-images", names: [name] }]);
  });

  it("sin ruta no hay nada que borrar y no se llama a Storage", async () => {
    const fake = createFake();
    expect(await removeCoverFile(fake.client, null)).toBe(true);
    expect(await removeCoverFile(fake.client, undefined)).toBe(true);
    expect(fake.storage.log).toEqual([]);
  });

  it.each(["../x.png", "x.png", "carpeta/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png", "/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.svg", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png.exe", "", "..%2fx.png", "\0.png"])(
    "se niega a borrar %j: no es un nombre generado y no se llama a Storage",
    async (path) => {
      const fake = createFake();
      expect(await removeCoverFile(fake.client, path)).toBe(false);
      expect(fake.storage.log).toEqual([]);
    },
  );

  it("un fallo o una excepción de Storage devuelve false", async () => {
    const name = generateCoverName("png");
    expect(await removeCoverFile(createFake({ storageObjects: [name], storageFailures: [{ op: "remove" }] }).client, name)).toBe(false);
    expect(await removeCoverFile(createFake({ storageObjects: [name], storageFailures: [{ op: "remove", throws: true }] }).client, name)).toBe(false);
  });
});
