import { beforeEach, describe, expect, it, vi } from "vitest";
import * as messages from "@/lib/admin/messages";
import { makePng } from "../storage/images";
import { createFake, form, LEAK_PATTERN, LEAKY_ERROR, seededOptions, type Actor } from "./support";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createClient } = await import("@/lib/supabase/server");
const { revalidatePath } = await import("next/cache");
const { uploadPostImage } = await import("@/lib/admin/posts/actions");

const ORIGIN = "https://proyecto.supabase.co";
const png = () => new File([new Uint8Array(makePng())], "imagen.png", { type: "image/png" });
const valid = () => form({ image: png(), alt: "Luna llena" });

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(revalidatePath).mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN);
});

describe.each<[string, Actor]>([
  ["anónimo", "anon"],
  ["autenticado sin rol admin", "user"],
  ["con Auth caído", "down"],
])("A01: %s no puede subir imágenes llamando a la acción", (_label, actor) => {
  it("es rechazado y Storage no se toca", async () => {
    const fake = createFake({ ...seededOptions(), as: actor });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const outcome = await uploadPostImage(null, valid()).then(
      () => null,
      (error: unknown) => error,
    );

    expect(outcome).not.toBeNull();
    expect(fake.storage.log).toEqual([]);
    expect(fake.storage.names).toEqual([]);
    expect(fake.writes).toEqual([]);
    expect(fake.touchedData).toEqual([]);
  });
});

describe("contraste: el admin sí puede", () => {
  it("sube la imagen y devuelve la URL y la línea de Markdown, sin escribir en la base de datos ni invalidar la caché", async () => {
    const fake = createFake(seededOptions());
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const state = await uploadPostImage(null, valid());
    expect(state).toMatchObject({ ok: true, alt: "Luna llena", url: expect.stringContaining(`${ORIGIN}/storage/v1/object/public/post-images/`) });
    expect((state as { markdown: string }).markdown).toMatch(/^!\[Luna llena\]\(https:\/\/proyecto\.supabase\.co\/storage\/v1\/object\/public\/post-images\/[0-9a-f-]{36}\.png\)$/);
    expect(fake.storage.log.filter((entry) => entry.op === "upload")).toHaveLength(1);
    expect(fake.writes).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sin texto alternativo devuelve el error de campo y no sube nada", async () => {
    const fake = createFake(seededOptions());
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const state = await uploadPostImage(null, form({ image: png(), alt: "" }));
    expect(state).toMatchObject({ ok: false, fieldErrors: { alt: messages.IMAGE_ALT_REQUIRED } });
    expect(fake.storage.log).toEqual([]);
  });

  it("un SVG devuelve el error de campo del archivo", async () => {
    const fake = createFake(seededOptions());
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const state = await uploadPostImage(null, form({ image: new File(["<svg onload=alert(1)/>"], "x.png", { type: "image/png" }), alt: "Alt" }));
    expect(state).toMatchObject({ ok: false, fieldErrors: { image: messages.COVER_INVALID_TYPE } });
    expect(fake.storage.log).toEqual([]);
  });

  it("si Storage falla, la respuesta no lleva URL ni línea de Markdown ni detalles internos", async () => {
    const fake = createFake({ ...seededOptions(), storageFailures: [{ op: "upload", error: LEAKY_ERROR }] });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const state = await uploadPostImage(null, valid());
    expect(state).toEqual({ ok: false, message: messages.GENERIC_ERROR });
    expect(JSON.stringify(state)).not.toMatch(LEAK_PATTERN);
  });

  it("sin la variable del proyecto no sube nada (la imagen no se podría mostrar)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const fake = createFake(seededOptions());
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    expect(await uploadPostImage(null, valid())).toMatchObject({ ok: false });
    expect(fake.storage.log).toEqual([]);
  });

  it("un campo desconocido rechaza la petición entera", async () => {
    const fake = createFake(seededOptions());
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const state = await uploadPostImage(null, form({ image: png(), alt: "Alt", cover_image_path: "../x.png" }));
    expect(state).toMatchObject({ ok: false });
    expect(fake.storage.log).toEqual([]);
  });
});
