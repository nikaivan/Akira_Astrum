import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Complementa owasp-checklist.test.ts: ninguna fila de las tablas puede quedar sin analizar (por ejemplo, por una barra
// vertical dentro de una celda), porque entonces sus rutas de evidencia no se comprobarían y su estado no contaría.
const text = readFileSync(new URL("../../../docs/owasp-checklist.md", import.meta.url), "utf8");

const categorySections = text
  .split(/^## /m)
  .slice(1)
  .map((part) => ({ title: part.split("\n")[0] ?? "", body: part }))
  .filter(({ title }) => /^A\d{2}\b/.test(title));

/** Líneas de datos de una tabla (ni la cabecera ni el separador). */
const dataLines = (body: string) =>
  body
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*-{3}/.test(line) && !/^\|\s*Medida\s*\|/.test(line));

describe("filas de las tablas del checklist", () => {
  it("hay diez categorías con filas", () => {
    expect(categorySections).toHaveLength(10);
    for (const { title, body } of categorySections) expect(dataLines(body).length, title).toBeGreaterThan(0);
  });

  it("toda fila tiene exactamente cinco columnas (medida, estado, evidencia, qué falta y cómo verificarlo)", () => {
    const malformed = categorySections.flatMap(({ title, body }) =>
      dataLines(body)
        .filter((line) => line.split("|").length - 2 !== 5)
        .map((line) => `${title.slice(0, 3)}: ${line.slice(0, 60)}`),
    );
    expect(malformed).toEqual([]);
  });

  it("ninguna celda está vacía", () => {
    const empty = categorySections.flatMap(({ title, body }) =>
      dataLines(body)
        .filter((line) => line.split("|").slice(1, -1).some((cell) => cell.trim() === ""))
        .map((line) => `${title.slice(0, 3)}: ${line.slice(0, 60)}`),
    );
    expect(empty).toEqual([]);
  });

  it("el total de filas coincide con el de las filas con cinco columnas (no se descarta ninguna)", () => {
    const all = categorySections.reduce((sum, { body }) => sum + dataLines(body).length, 0);
    const parsed = categorySections.reduce((sum, { body }) => sum + dataLines(body).filter((line) => line.split("|").length - 2 === 5).length, 0);
    expect(parsed).toBe(all);
    expect(all).toBeGreaterThanOrEqual(40);
  });
});
