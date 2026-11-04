import { beforeAll, describe, expect, it, vi } from "vitest";
import { insertImage } from "@/lib/admin/image-insert";
import * as messages from "@/lib/admin/messages";
import { makePng } from "../storage/images";

const URL_OK = "https://proyecto.supabase.co/storage/v1/object/public/post-images/11111111-2222-3333-4444-555555555555.png";
const MARKDOWN = `![Luna llena](${URL_OK})`;
const png = () => new File([new Uint8Array(makePng())], "imagen.png", { type: "image/png" });
const SUCCESS = { ok: true, url: URL_OK, alt: "Luna llena", markdown: MARKDOWN };

beforeAll(() => {
  for (const key of ["IMAGE_FILE_REQUIRED", "IMAGE_ALT_REQUIRED"]) expect(messages).toHaveProperty(key, expect.any(String));
});

describe("insertImage: lo que hace el editor antes y después de subir", () => {
  it("sube el archivo y el texto alternativo con los nombres de campo acordados y devuelve la línea de Markdown", async () => {
    const upload = vi.fn<(data: FormData) => Promise<unknown>>(async () => SUCCESS);
    const image = png();
    expect(await insertImage({ upload, image, alt: "  Luna llena " })).toEqual({ ok: true, markdown: MARKDOWN });
    expect(upload).toHaveBeenCalledTimes(1);
    const data = upload.mock.calls[0][0];
    expect([...data.keys()].sort()).toEqual(["alt", "image"]);
    expect(data.get("alt")).toBe("Luna llena");
    expect(data.get("image")).toBeInstanceOf(File);
  });

  it.each([
    ["vacío", ""],
    ["solo espacios", "   "],
  ])("sin texto alternativo (%s) no se llama a la acción y se explica el motivo", async (_caso, alt) => {
    const upload = vi.fn();
    expect(await insertImage({ upload, image: png(), alt })).toEqual({ ok: false, message: messages.VALIDATION_SUMMARY, fieldErrors: { alt: messages.IMAGE_ALT_REQUIRED } });
    expect(upload).not.toHaveBeenCalled();
  });

  it("sin archivo no se llama a la acción", async () => {
    const upload = vi.fn();
    expect(await insertImage({ upload, image: null, alt: "Luna" })).toEqual({ ok: false, message: messages.VALIDATION_SUMMARY, fieldErrors: { image: messages.IMAGE_FILE_REQUIRED } });
    expect(upload).not.toHaveBeenCalled();
  });

  it("sin archivo ni texto alternativo señala los dos campos", async () => {
    const upload = vi.fn();
    expect(await insertImage({ upload, image: null, alt: "" })).toMatchObject({ ok: false, fieldErrors: { image: messages.IMAGE_FILE_REQUIRED, alt: messages.IMAGE_ALT_REQUIRED } });
    expect(upload).not.toHaveBeenCalled();
  });

  it("un archivo de más de 2 MB se rechaza en el navegador sin enviarlo (el servidor lo vuelve a comprobar)", async () => {
    const upload = vi.fn();
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "grande.png", { type: "image/png" });
    expect(await insertImage({ upload, image: big, alt: "Luna" })).toMatchObject({ ok: false, fieldErrors: { image: messages.COVER_TOO_LARGE } });
    expect(upload).not.toHaveBeenCalled();
  });

  it("los errores de la acción llegan tal cual y no se devuelve ninguna línea", async () => {
    const failure = { ok: false, message: messages.VALIDATION_SUMMARY, fieldErrors: { image: messages.COVER_INVALID_TYPE } };
    const result = await insertImage({ upload: async () => failure, image: png(), alt: "Luna" });
    expect(result).toEqual(failure);
    expect(result).not.toHaveProperty("markdown");
  });

  it.each([
    ["la acción lanza una excepción", () => Promise.reject(new Error("fallo de red con detalles internos 10.0.0.5"))],
    ["la acción devuelve null", async () => null],
    ["la acción devuelve algo que no es un resultado", async () => "texto"],
    ["el resultado es correcto pero no lleva línea", async () => ({ ok: true, url: URL_OK, alt: "x" })],
    ["la línea no es una imagen", async () => ({ ok: true, url: URL_OK, alt: "x", markdown: "<script>alert(1)</script>" })],
    ["la línea tiene varias líneas", async () => ({ ok: true, url: URL_OK, alt: "x", markdown: `${MARKDOWN}\n\nTexto añadido` })],
    ["la línea no apunta al Storage del proyecto", async () => ({ ok: true, url: URL_OK, alt: "x", markdown: "![x](https://evil.test/a.png)" })],
  ])("falla cerrado (A10) cuando %s: error genérico, sin línea y sin detalles", async (_caso, upload) => {
    const result = await insertImage({ upload: upload as never, image: png(), alt: "Luna" });
    expect(result).toEqual({ ok: false, message: messages.GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toMatch(/10\.0\.0\.5|detalles/);
  });
});
