import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/lib/posts/slug";

// Seguro: el guion obligatorio entre grupos evita el retroceso exponencial.
// eslint-disable-next-line security/detect-unsafe-regex
const SAFE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const INVALID_TITLE = "Título no válido";

describe("slugify", () => {
  it.each([
    ["pasa a minúsculas y une con guiones", "Hola Mundo", "hola-mundo"],
    ["quita tildes", "Qué es la astrología", "que-es-la-astrologia"],
    ["convierte la ñ y la ü", "Año nuevo Ñandú Pingüino", "ano-nuevo-nandu-pinguino"],
    ["mayúsculas con tilde", "ÉXITO ÁLGEBRA", "exito-algebra"],
    ["colapsa espacios, tabuladores y saltos de línea", "  Hola   \t mundo \n", "hola-mundo"],
    [
      "símbolos y puntuación se convierten en un solo guion",
      "¿Cómo será 2027? ¡Tauro & Leo!",
      "como-sera-2027-tauro-leo",
    ],
    ["quita guiones repetidos y de los extremos", "--Hola -- mundo--", "hola-mundo"],
    ["conserva los números", "Los 12 signos", "los-12-signos"],
    ["normaliza Unicode de compatibilidad", "ＡＢＣ", "abc"],
    ["elimina emoji entre palabras", "Luna 🌙 llena", "luna-llena"],
    ["emoji al principio", "🌙 Luna", "luna"],
    ["emoji al final", "Luna llena 🌙✨", "luna-llena"],
    ["símbolos del zodiaco junto a texto", "♈ Aries: guía 2027", "aries-guia-2027"],
  ])("%s", (_nombre, titulo, esperado) => {
    expect(slugify(titulo)).toBe(esperado);
  });

  it.each(["Hola Mundo", "¿Cómo será 2027?", "Año nuevo Ñandú", "Luna 🌙 llena"])(
    "es idempotente: %s",
    (titulo) => {
      expect(slugify(slugify(titulo))).toBe(slugify(titulo));
    },
  );

  it.each([
    ["título vacío", ""],
    ["título en blanco", "   \n\t"],
    ["solo signos de puntuación", "!!!"],
    ["solo emoji", "🌙✨"],
    ["solo alfabeto no latino", "漢字"],
    ["solo puntos", ".."],
    ["solo ruta relativa", "./"],
    ["solo ruta relativa hacia arriba", "../"],
  ])("lanza error si no queda nada utilizable: %s", (_nombre, titulo) => {
    expect(() => slugify(titulo)).toThrow(INVALID_TITLE);
  });

  it("recorta un título muy largo a 80 caracteres", () => {
    expect(slugify("a".repeat(300))).toBe("a".repeat(80));
  });

  it("el recorte no deja un guion al final", () => {
    const slug = slugify("palabra ".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });

  describe("con entradas maliciosas", () => {
    it.each([
      ["<script>alert('x')</script>", "script-alert-x-script"],
      ["<img src=x onerror=alert(1)>", "img-src-x-onerror-alert-1"],
      ["javascript:alert(1)", "javascript-alert-1"],
      ["../../etc/passwd", "etc-passwd"],
      ["..\\..\\windows\\system32", "windows-system32"],
      ["a/b\\c", "a-b-c"],
      ["a\u0000b", "a-b"],
      ["hola\u202Emundo", "hola-mundo"],
      ["%2e%2e%2fadmin", "2e-2e-2fadmin"],
      ["'; DROP TABLE posts; --", "drop-table-posts"],
    ])("neutraliza %j", (entrada, esperado) => {
      const slug = slugify(entrada);
      expect(slug).toBe(esperado);
      expect(slug).toMatch(SAFE_SLUG);
    });
  });
});

describe("uniqueSlug", () => {
  it("devuelve la base si está libre", () => {
    expect(uniqueSlug("hola-mundo", [])).toBe("hola-mundo");
  });

  it("añade -2 si la base está ocupada", () => {
    expect(uniqueSlug("hola-mundo", ["hola-mundo"])).toBe("hola-mundo-2");
  });

  it("sigue la numeración", () => {
    const taken = ["hola-mundo", "hola-mundo-2", "hola-mundo-3"];
    expect(uniqueSlug("hola-mundo", taken)).toBe("hola-mundo-4");
  });

  it("usa el primer hueco libre", () => {
    expect(uniqueSlug("hola-mundo", ["hola-mundo", "hola-mundo-3"])).toBe("hola-mundo-2");
  });

  it("un prefijo no cuenta como ocupado", () => {
    expect(uniqueSlug("hola", ["hola-mundo"])).toBe("hola");
  });

  it("respeta el límite de 80 caracteres al añadir el sufijo", () => {
    const base = "a".repeat(80);
    const slug = uniqueSlug(base, [base]);
    expect(slug).toBe(`${"a".repeat(78)}-2`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug).not.toContain("--");
  });

  it("no muta la lista recibida", () => {
    const taken = Object.freeze(["hola-mundo"]);
    expect(() => uniqueSlug("hola-mundo", taken)).not.toThrow();
    expect(taken).toEqual(["hola-mundo"]);
  });

  it.each(["", "../x", "Hola Mundo", "<b>"])("rechaza una base que no es un slug: %j", (base) => {
    expect(() => uniqueSlug(base, [])).toThrow();
  });
});
