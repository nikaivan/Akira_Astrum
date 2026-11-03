import { describe, expect, it } from "vitest";
import { parsePostDeleteForm, parsePostForm, parsePostIdForm, POST_LIMITS } from "@/lib/admin/posts/schema";
import { CAT_A, CAT_B, POST_DRAFT } from "./support";

const valid = (extra: Record<string, unknown> = {}) => ({
  title: "Mi primera entrada",
  slug: "",
  content: "Hola **mundo**",
  categoryIds: [],
  intent: "save",
  ...extra,
});
const update = (extra: Record<string, unknown> = {}) => valid({ id: POST_DRAFT, ...extra });

const failure = (input: unknown, mode: "create" | "update" = "create") => {
  const result = parsePostForm(input, mode);
  if (result.success) throw new Error("Se esperaba un rechazo");
  return result.errors;
};

describe("límites acordados", () => {
  it("coinciden con el plan y con los CHECK de la base de datos", () => {
    expect(POST_LIMITS).toMatchObject({ title: 200, slug: 80, content: 50_000, categories: 10 });
  });
});

describe("parsePostForm: entradas válidas", () => {
  it("acepta una entrada mínima y la devuelve normalizada", () => {
    const result = parsePostForm(valid({ title: "  Con espacios  " }), "create");
    expect(result).toEqual({ success: true, data: { title: "Con espacios", slug: "", content: "Hola **mundo**", categoryIds: [], intent: "save" } });
  });

  it("acepta intent publish al crear y save, publish y unpublish al editar", () => {
    expect(parsePostForm(valid({ intent: "publish" }), "create").success).toBe(true);
    for (const intent of ["save", "publish", "unpublish"]) expect(parsePostForm(update({ intent }), "update").success).toBe(true);
  });

  it("acepta el id al editar", () => {
    const result = parsePostForm(update(), "update");
    expect(result.success && result.data).toMatchObject({ id: POST_DRAFT });
  });

  it("acepta categorías con UUID válido", () => {
    expect(parsePostForm(valid({ categoryIds: [CAT_A, CAT_B] }), "create").success).toBe(true);
  });

  it("el contenido llega intacto: sin recortar espacios ni sanitizar", () => {
    const content = '  \n<script>alert(1)</script> <img src=x onerror="x()"> [a](javascript:x)\n\n';
    const result = parsePostForm(valid({ content }), "create");
    expect(result.success && result.data.content).toBe(content);
  });

  it("un script en el título se acepta como texto (se sanitiza al mostrar, no al guardar)", () => {
    const result = parsePostForm(valid({ title: "<script>alert(1)</script>" }), "create");
    expect(result.success && result.data.title).toBe("<script>alert(1)</script>");
  });

  it("el contenido puede estar vacío", () => {
    expect(parsePostForm(valid({ content: "" }), "create").success).toBe(true);
  });
});

describe("parsePostForm: título", () => {
  it.each([["vacío", ""], ["solo espacios", "   \t "], ["más de 200 caracteres", "a".repeat(201)]])("rechaza un título %s", (_caso, title) => {
    expect(failure(valid({ title })).title).toEqual(expect.any(String));
  });

  it("acepta exactamente 200 caracteres", () => {
    expect(parsePostForm(valid({ title: "a".repeat(200) }), "create").success).toBe(true);
  });

  it("los 200 caracteres se cuentan después de recortar", () => {
    expect(parsePostForm(valid({ title: `  ${"a".repeat(200)}  ` }), "create").success).toBe(true);
  });
});

describe("parsePostForm: slug", () => {
  it.each([
    ["mayúsculas", "Hola"],
    ["espacios", "hola mundo"],
    ["guiones dobles", "hola--mundo"],
    ["guion inicial", "-hola"],
    ["guion final", "hola-"],
    ["ruta relativa", "../etc/passwd"],
    ["barra", "a/b"],
    ["acentos", "canción"],
    ["más de 80 caracteres", "a".repeat(81)],
  ])("rechaza un slug con %s", (_caso, slug) => {
    expect(failure(valid({ slug })).slug).toEqual(expect.any(String));
  });

  it("acepta un slug válido de hasta 80 caracteres y deja vacío el autogenerado", () => {
    expect(parsePostForm(valid({ slug: "a".repeat(80) }), "create").success).toBe(true);
    expect(parsePostForm(valid({ slug: "luna-nueva-2026" }), "create").success).toBe(true);
    const empty = parsePostForm(valid({ slug: "" }), "create");
    expect(empty.success && empty.data.slug).toBe("");
  });

  it("un slug ausente equivale a vacío", () => {
    const { slug: _slug, ...rest } = valid();
    const result = parsePostForm(rest, "create");
    expect(result.success && result.data.slug).toBe("");
  });
});

describe("parsePostForm: contenido", () => {
  it("acepta 50 000 caracteres y rechaza 50 001", () => {
    expect(parsePostForm(valid({ content: "a".repeat(50_000) }), "create").success).toBe(true);
    expect(failure(valid({ content: "a".repeat(50_001) })).content).toEqual(expect.any(String));
  });
});

describe("parsePostForm: categorías", () => {
  it.each([
    ["un valor que no es UUID", ["no-es-uuid"]],
    ["un id con inyección", [`${CAT_A}' or '1'='1`]],
    ["un valor vacío", [""]],
    ["ids repetidos", [CAT_A, CAT_A]],
    ["más de 10 categorías", Array.from({ length: 11 }, () => crypto.randomUUID())],
  ])("rechaza %s", (_caso, categoryIds) => {
    expect(failure(valid({ categoryIds })).categoryIds).toEqual(expect.any(String));
  });

  it("acepta exactamente 10 categorías distintas", () => {
    const categoryIds = Array.from({ length: 10 }, () => crypto.randomUUID());
    expect(parsePostForm(valid({ categoryIds }), "create").success).toBe(true);
  });
});

describe("parsePostForm: estado (intent)", () => {
  it.each(["archived", "draft", "published", "", "PUBLISH", "unpublish"])("al crear rechaza el intent %j", (intent) => {
    expect(failure(valid({ intent }), "create").intent).toEqual(expect.any(String));
  });

  it("al editar rechaza un intent no permitido", () => {
    expect(failure(update({ intent: "archived" }), "update").intent).toEqual(expect.any(String));
  });
});

describe("parsePostForm: tipos incorrectos", () => {
  it.each([
    ["título numérico", { title: 123 }],
    ["título nulo", { title: null }],
    ["título objeto", { title: { $ne: "" } }],
    ["título array", { title: ["a", "b"] }],
    ["título archivo", { title: new Blob(["x"]) }],
    ["contenido numérico", { content: 5 }],
    ["slug array", { slug: ["a"] }],
    ["categoryIds texto", { categoryIds: CAT_A }],
    ["categoryIds objeto", { categoryIds: { 0: CAT_A } }],
    ["intent numérico", { intent: 1 }],
  ])("rechaza %s", (_caso, extra) => {
    expect(parsePostForm(valid(extra), "create").success).toBe(false);
  });

  it.each([null, undefined, "texto", 5, []])("rechaza una entrada que no es un objeto: %j", (input) => {
    expect(parsePostForm(input, "create").success).toBe(false);
  });

  it("falta el título", () => {
    const { title: _title, ...rest } = valid();
    expect(failure(rest).title).toEqual(expect.any(String));
  });
});

describe("parsePostForm: mass assignment (modo estricto)", () => {
  const FORBIDDEN = ["author_id", "created_at", "updated_at", "published_at", "status", "cover_image_path", "content_md", "__proto__", "constructor", "desconocido"];

  it.each(FORBIDDEN)("rechaza el campo %s al crear", (name) => {
    const input = Object.defineProperty({ ...valid() }, name, { value: "x", enumerable: true, configurable: true, writable: true });
    const errors = failure(input);
    expect(errors.form).toEqual(expect.any(String));
  });

  it.each(FORBIDDEN)("rechaza el campo %s al editar", (name) => {
    const input = Object.defineProperty({ ...update() }, name, { value: "x", enumerable: true, configurable: true, writable: true });
    expect(failure(input, "update").form).toEqual(expect.any(String));
  });

  it("rechaza el id al crear (lo genera la base de datos)", () => {
    expect(failure(valid({ id: POST_DRAFT })).form).toEqual(expect.any(String));
  });

  it("al editar, el id es obligatorio y debe ser un UUID", () => {
    expect(parsePostForm(valid(), "update").success).toBe(false);
    expect(parsePostForm(update({ id: "no-uuid" }), "update").success).toBe(false);
  });

  it("el rechazo no revela el nombre del campo prohibido", () => {
    const errors = failure(valid({ author_id: ADMIN_LIKE }));
    expect(JSON.stringify(errors)).not.toMatch(/author_id/);
  });
});

const ADMIN_LIKE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("parsePostIdForm y parsePostDeleteForm", () => {
  it("el id es un UUID y no admite más campos", () => {
    expect(parsePostIdForm({ id: POST_DRAFT }).success).toBe(true);
    expect(parsePostIdForm({ id: "x" }).success).toBe(false);
    expect(parsePostIdForm({}).success).toBe(false);
    expect(parsePostIdForm({ id: POST_DRAFT, published_at: "2026-01-01" }).success).toBe(false);
    expect(parsePostIdForm({ id: POST_DRAFT, status: "published" }).success).toBe(false);
  });

  it("eliminar exige la confirmación literal «eliminar»", () => {
    expect(parsePostDeleteForm({ id: POST_DRAFT, confirm: "eliminar" }).success).toBe(true);
    for (const confirm of [undefined, "", "ELIMINAR", "si", "true", "eliminar "]) {
      expect(parsePostDeleteForm({ id: POST_DRAFT, confirm }).success).toBe(false);
    }
    expect(parsePostDeleteForm({ id: POST_DRAFT, confirm: "eliminar", extra: "x" }).success).toBe(false);
  });
});
