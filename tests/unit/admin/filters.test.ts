import { describe, expect, it } from "vitest";
import { parseListFilters } from "@/lib/admin/posts/filters";

describe("parseListFilters", () => {
  it("sin parámetros: todas las entradas y ninguna categoría", () => {
    expect(parseListFilters({})).toEqual({ status: "all", category: null });
  });

  it("acepta los estados borrador y publicada y un slug de categoría válido", () => {
    expect(parseListFilters({ estado: "borrador" })).toEqual({ status: "draft", category: null });
    expect(parseListFilters({ estado: "publicada", categoria: "signos-de-fuego" })).toEqual({ status: "published", category: "signos-de-fuego" });
  });

  it.each(["archived", "BORRADOR", "", "draft", "' or 1=1 --"])("un estado no válido (%j) vuelve al valor por defecto", (estado) => {
    expect(parseListFilters({ estado }).status).toBe("all");
  });

  it.each(["Mayúsculas", "con espacios", "a--b", "../x", "a".repeat(81), "' or 1=1 --", "<script>"])("un slug de categoría no válido (%j) se descarta", (categoria) => {
    expect(parseListFilters({ categoria }).category).toBeNull();
  });

  it("un parámetro repetido (array) se descarta", () => {
    expect(parseListFilters({ estado: ["borrador", "publicada"], categoria: ["a", "b"] })).toEqual({ status: "all", category: null });
  });
});
