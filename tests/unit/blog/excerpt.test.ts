import { describe, expect, it } from "vitest";
import { excerptOf } from "@/lib/blog/excerpt";
import { words } from "./support";

describe("excerptOf (descripción de la página)", () => {
  it("devuelve el texto plano sin las marcas de Markdown", () => {
    expect(excerptOf("# Hola **mundo**\n\nUn [enlace](https://ejemplo.test) y `código`.")).toBe("Hola mundo Un enlace y código.");
  });

  it("deja un texto corto tal cual, sin saltos de línea ni espacios repetidos", () => {
    expect(excerptOf("  Una\n\n  frase   corta.  ")).toBe("Una frase corta.");
  });

  it("recorta a un máximo de 160 caracteres en una frontera de palabra y añade …", () => {
    const long = words(100);
    const excerpt = excerptOf(long);
    expect(excerpt.length).toBeLessThanOrEqual(160);
    expect(excerpt.endsWith("…")).toBe(true);
    const cut = excerpt.slice(0, -1);
    expect(long.startsWith(cut)).toBe(true);
    expect(long.charAt(cut.length)).toBe(" ");
  });

  it("respeta un máximo distinto", () => {
    expect(excerptOf(words(100), 40).length).toBeLessThanOrEqual(40);
  });

  it("no deja nunca ángulos ni etiquetas (va a una metaetiqueta)", () => {
    const excerpt = excerptOf('<script>alert(1)</script> Texto <img src=x onerror="alert(1)"> final **<b>negrita</b>**');
    expect(excerpt).not.toMatch(/[<>]/);
    expect(excerpt).toContain("Texto");
    expect(excerpt).toContain("final");
  });

  it.each(["", "   ", "***", "---"])("sin texto (%j) devuelve una cadena vacía", (source) => {
    expect(excerptOf(source)).toBe("");
  });
});
