import { beforeAll, describe, expect, it } from "vitest";
import { formDataToObject } from "@/lib/admin/form-data";
import * as messages from "@/lib/admin/messages";
import { parsePostForm } from "@/lib/admin/posts/schema";
import { makePng } from "../storage/images";
import { form, POST_DRAFT } from "./support";

// Sin esto, un mensaje que aún no existe (undefined) "coincidiría" con un error que tampoco existe.
beforeAll(() => {
  for (const key of ["COVER_ALT_REQUIRED", "COVER_ALT_TOO_LONG", "COVER_ALT_WITHOUT_COVER", "COVER_CONFLICT", "INVALID_REQUEST"]) {
    expect(messages).toHaveProperty(key, expect.any(String));
  }
});

const image = () => new File([new Uint8Array(makePng())], "portada.png", { type: "image/png" });
const valid = (extra: Record<string, unknown> = {}) => ({ title: "Mi entrada", slug: "", content: "Hola", categoryIds: [], intent: "save", ...extra });
const update = (extra: Record<string, unknown> = {}) => valid({ id: POST_DRAFT, ...extra });

const failure = (input: unknown, mode: "create" | "update" = "create") => {
  const result = parsePostForm(input, mode);
  if (result.success) throw new Error("Se esperaba un rechazo");
  return result.errors;
};

describe("portada: entradas válidas", () => {
  it("acepta un archivo con su texto alternativo, recortado", () => {
    const file = image();
    const result = parsePostForm(valid({ cover: file, coverAlt: "  Luna llena sobre el mar  " }), "create");
    expect(result.success && result.data.cover).toBe(file);
    expect(result.success && result.data.coverAlt).toBe("Luna llena sobre el mar");
  });

  it("acepta exactamente 200 caracteres de alt", () => {
    expect(parsePostForm(valid({ cover: image(), coverAlt: "a".repeat(200) }), "create").success).toBe(true);
  });

  it("sin portada ni alt, la entrada sigue siendo válida y no aparecen claves de portada", () => {
    const result = parsePostForm(valid(), "create");
    expect(result.success && result.data.cover).toBeUndefined();
    expect(result.success && result.data.coverAlt).toBeUndefined();
    expect(result.success && result.data.removeCover).toBeUndefined();
  });

  it("al editar, un alt sin archivo es válido (cambiar solo el texto alternativo)", () => {
    const result = parsePostForm(update({ coverAlt: "Nuevo texto" }), "update");
    expect(result.success && result.data.coverAlt).toBe("Nuevo texto");
    expect(result.success && result.data.cover).toBeUndefined();
  });

  it("removeCover con el valor «on» se acepta al editar", () => {
    const result = parsePostForm(update({ removeCover: "on" }), "update");
    expect(result.success && result.data.removeCover).toBe(true);
  });
});

describe("portada: texto alternativo obligatorio", () => {
  it.each([["ausente", undefined], ["vacío", ""], ["solo espacios", "   \t "]])("con un archivo, un alt %s se rechaza", (_caso, coverAlt) => {
    expect(failure(valid({ cover: image(), coverAlt })).coverAlt).toBe(messages.COVER_ALT_REQUIRED);
  });

  it("más de 200 caracteres se rechaza", () => {
    expect(failure(valid({ cover: image(), coverAlt: "a".repeat(201) })).coverAlt).toBe(messages.COVER_ALT_TOO_LONG);
  });

  it("al crear, un alt sin archivo se rechaza", () => {
    expect(failure(valid({ coverAlt: "Texto suelto" })).coverAlt).toBe(messages.COVER_ALT_WITHOUT_COVER);
  });

  it("el alt no se interpreta: un script se acepta como texto", () => {
    const result = parsePostForm(valid({ cover: image(), coverAlt: "<script>alert(1)</script>" }), "create");
    expect(result.success && result.data.coverAlt).toBe("<script>alert(1)</script>");
  });
});

describe("portada: el archivo", () => {
  it("un campo de archivo sin selección (nombre vacío y 0 bytes) equivale a no enviar archivo", () => {
    const result = parsePostForm(valid({ cover: new File([], "") }), "create");
    expect(result.success).toBe(true);
    expect(result.success && result.data.cover).toBeUndefined();
  });

  it("en el servidor de Next el campo vacío llega como un archivo de 0 bytes con el nombre indefinido: también es «sin archivo»", () => {
    const empty = Object.defineProperty(new File([], "x"), "name", { value: undefined });
    const result = parsePostForm(valid({ cover: empty }), "create");
    expect(result.success).toBe(true);
    expect(result.success && result.data.cover).toBeUndefined();
    const edited = parsePostForm(update({ cover: empty }), "update");
    expect(edited.success && edited.data.cover).toBeUndefined();
  });

  it("un archivo vacío CON nombre llega al servicio, que lo rechazará como vacío", () => {
    const file = new File([], "vacio.png", { type: "image/png" });
    const result = parsePostForm(valid({ cover: file, coverAlt: "Alt" }), "create");
    expect(result.success && result.data.cover).toBe(file);
  });

  it.each([
    ["un texto", "portada.png"],
    ["un número", 5],
    ["un objeto", { name: "x.png" }],
    ["un array de archivos", [image(), image()]],
    ["un array de textos", ["a", "b"]],
    ["nulo", null],
  ])("%s no es un archivo y se rechaza", (_caso, cover) => {
    expect(failure(valid({ cover, coverAlt: "Alt" })).cover).toEqual(expect.any(String));
  });
});

describe("portada: quitar", () => {
  it.each(["true", "1", "", "off", "ON", "yes"])("removeCover solo admite «on»: %j se rechaza", (removeCover) => {
    expect(failure(update({ removeCover }), "update").form).toBe(messages.INVALID_REQUEST);
  });

  it("no se puede quitar y subir a la vez", () => {
    expect(failure(update({ removeCover: "on", cover: image(), coverAlt: "Alt" }), "update").cover).toBe(messages.COVER_CONFLICT);
  });

  it("al crear no hay nada que quitar", () => {
    expect(failure(valid({ removeCover: "on" })).form).toBe(messages.INVALID_REQUEST);
  });
});

describe("portada: nunca se acepta una ruta del cliente (mass assignment)", () => {
  it.each(["cover_image_path", "cover_alt", "coverPath", "cover_url"])("el campo %s rechaza todo el envío sin nombrarlo", (name) => {
    const errors = failure(valid({ [name]: "../../etc/passwd.png" }));
    expect(errors.form).toBe(messages.INVALID_REQUEST);
    expect(JSON.stringify(errors)).not.toContain(name);
  });

  it("tampoco al editar", () => {
    expect(failure(update({ cover_image_path: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png" }), "update").form).toBe(messages.INVALID_REQUEST);
  });
});

describe("portada desde un FormData real", () => {
  it("el archivo y el alt llegan al esquema como File y texto", () => {
    const file = image();
    const result = parsePostForm(formDataToObject(form({ title: "Entrada", slug: "", content: "", intent: "save", cover: file, coverAlt: "Foto" })), "create");
    expect(result.success && result.data.cover).toBeInstanceOf(File);
    expect(result.success && result.data.coverAlt).toBe("Foto");
  });

  it("un formulario sin elegir archivo (como lo envía el navegador) es válido", () => {
    const data = new FormData();
    for (const [name, value] of Object.entries({ title: "Entrada", slug: "", content: "", intent: "save", coverAlt: "" })) data.append(name, value);
    data.append("cover", new File([], ""));
    expect(parsePostForm(formDataToObject(data), "create").success).toBe(true);
  });
});
