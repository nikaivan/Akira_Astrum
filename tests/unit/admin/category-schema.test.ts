import { describe, expect, it } from "vitest";
import { CATEGORY_LIMITS, parseCategoryDeleteForm, parseCategoryForm } from "@/lib/admin/categories/schema";
import { CAT_A } from "./support";

const fail = (input: unknown, mode: "create" | "rename" = "create") => {
  const result = parseCategoryForm(input, mode);
  if (result.success) throw new Error("Se esperaba un rechazo");
  return result.errors;
};

describe("parseCategoryForm", () => {
  it("el límite del nombre coincide con el CHECK de la base de datos", () => {
    expect(CATEGORY_LIMITS.name).toBe(60);
  });

  it("acepta un nombre y lo recorta", () => {
    expect(parseCategoryForm({ name: "  Signos de fuego " }, "create")).toEqual({ success: true, data: { name: "Signos de fuego" } });
  });

  it("al renombrar exige un id UUID", () => {
    expect(parseCategoryForm({ id: CAT_A, name: "Nuevo" }, "rename")).toEqual({ success: true, data: { id: CAT_A, name: "Nuevo" } });
    expect(parseCategoryForm({ name: "Nuevo" }, "rename").success).toBe(false);
    expect(parseCategoryForm({ id: "x", name: "Nuevo" }, "rename").success).toBe(false);
  });

  it.each([["vacío", ""], ["solo espacios", "   "], ["más de 60 caracteres", "a".repeat(61)]])("rechaza un nombre %s", (_caso, name) => {
    expect(fail({ name }).name).toEqual(expect.any(String));
  });

  it("acepta exactamente 60 caracteres", () => {
    expect(parseCategoryForm({ name: "a".repeat(60) }, "create").success).toBe(true);
  });

  it.each([
    ["número", { name: 5 }],
    ["nulo", { name: null }],
    ["array", { name: ["a"] }],
    ["archivo", { name: new Blob(["x"]) }],
  ])("rechaza un nombre de tipo %s", (_caso, input) => {
    expect(parseCategoryForm(input, "create").success).toBe(false);
  });

  it("el slug no es un campo editable: se genera a partir del nombre", () => {
    expect(fail({ name: "Fuego", slug: "fuego" }).form).toEqual(expect.any(String));
    expect(fail({ name: "Fuego", slug: "fuego", id: CAT_A }, "rename").form).toEqual(expect.any(String));
  });

  it.each(["created_at", "id", "author_id", "__proto__", "desconocido"])("rechaza el campo %s al crear", (name) => {
    const input = Object.defineProperty({ name: "Fuego" }, name, { value: "x", enumerable: true, configurable: true, writable: true });
    expect(parseCategoryForm(input, "create").success).toBe(false);
  });

  it.each([null, undefined, "texto", 5])("rechaza una entrada que no es un objeto: %j", (input) => {
    expect(parseCategoryForm(input, "create").success).toBe(false);
  });
});

describe("parseCategoryDeleteForm", () => {
  it("exige id UUID y la confirmación literal «eliminar»", () => {
    expect(parseCategoryDeleteForm({ id: CAT_A, confirm: "eliminar" }).success).toBe(true);
    expect(parseCategoryDeleteForm({ id: CAT_A }).success).toBe(false);
    expect(parseCategoryDeleteForm({ id: CAT_A, confirm: "si" }).success).toBe(false);
    expect(parseCategoryDeleteForm({ id: "x", confirm: "eliminar" }).success).toBe(false);
    expect(parseCategoryDeleteForm({ id: CAT_A, confirm: "eliminar", name: "x" }).success).toBe(false);
  });
});
