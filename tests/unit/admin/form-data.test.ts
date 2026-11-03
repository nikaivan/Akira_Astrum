import { describe, expect, it } from "vitest";
import { formDataToObject } from "@/lib/admin/form-data";
import { form } from "./support";

describe("formDataToObject", () => {
  it("convierte los campos de texto en un objeto", () => {
    expect(formDataToObject(form({ title: "Hola", slug: "hola" }))).toEqual({ title: "Hola", slug: "hola", categoryIds: [] });
  });

  it("categoryIds es siempre un array, tenga una, varias o ninguna casilla marcada", () => {
    expect(formDataToObject(form({ title: "x" })).categoryIds).toEqual([]);
    expect(formDataToObject(form({ categoryIds: ["a"] })).categoryIds).toEqual(["a"]);
    expect(formDataToObject(form({ categoryIds: ["a", "b"] })).categoryIds).toEqual(["a", "b"]);
  });

  it("ignora solo las claves internas $ACTION_ que añade React", () => {
    const data = form({ title: "Hola", "$ACTION_REF_1": "", "$ACTION_1:0": "{}", "$ACTION_KEY": "k" });
    expect(Object.keys(formDataToObject(data)).sort()).toEqual(["categoryIds", "title"]);
  });

  it("una clave repetida en un campo escalar se conserva como array, para que el esquema la rechace", () => {
    const data = new FormData();
    data.append("title", "uno");
    data.append("title", "dos");
    expect(formDataToObject(data).title).toEqual(["uno", "dos"]);
  });

  it("un archivo se conserva como archivo, para que el esquema lo rechace", () => {
    const value = formDataToObject(form({ title: new Blob(["x"]) })).title;
    expect(typeof value).not.toBe("string");
  });

  it("una clave __proto__ o constructor llega como clave propia y no altera el prototipo", () => {
    // Con un literal de objeto, "__proto__" no crearía la clave: se añade a mano.
    const data = form({ title: "Hola", constructor: "y" });
    data.append("__proto__", "x");
    const result = formDataToObject(data);
    expect(Object.keys(result)).toEqual(expect.arrayContaining(["__proto__", "constructor"]));
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
