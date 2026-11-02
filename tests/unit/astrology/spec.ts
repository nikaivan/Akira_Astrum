/* eslint-disable security/detect-object-injection -- claves de datos de prueba controlados */
import { readFileSync } from "node:fs";

type LevelCode = "alta" | "media" | "baja";

export type SpecSign = {
  name: string;
  symbol: string;
  from: { day: number; month: number };
  to: { day: number; month: number };
  element: string;
  modality: string;
};

const LEVEL_OF_LETTER: Record<string, LevelCode> = { A: "alta", M: "media", B: "baja" };

const DOCUMENT = readFileSync("docs/astrologia-reglas.md", "utf-8");

function section(start: string, end: string): string {
  const from = DOCUMENT.indexOf(start);
  const to = DOCUMENT.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Sección no encontrada: ${start}`);
  return DOCUMENT.slice(from, to);
}

/** Filas de las tablas Markdown de la sección, con la cabecera y sin la línea de guiones. */
function tableRows(text: string): string[][] {
  return text
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim().replaceAll("**", "")),
    )
    .filter((cells) => !cells.every((cell) => /^-+$/.test(cell)));
}

function dayMonth(cell: string): { day: number; month: number } {
  const [day, month] = cell.split("/").map(Number);
  return { day, month };
}

function readSigns(): SpecSign[] {
  const [, ...rows] = tableRows(section("## 2. Tabla de signos", "## 3."));
  return rows.map(([name, symbol, from, to, element, modality]) => ({
    name,
    symbol,
    from: dayMonth(from),
    to: dayMonth(to),
    element,
    modality,
  }));
}

function readLevels() {
  const [, ...rows] = tableRows(section("## 3. Niveles", "## 4."));
  return rows.map(([code, name, description]) => ({ code: code as LevelCode, name, description }));
}

function readMatrix(): Record<string, Record<string, LevelCode>> {
  const [header, ...rows] = tableRows(section("### 4.1", "### 4.2"));
  const columns = header.slice(1);
  return Object.fromEntries(
    rows.map(([name, ...letters]) => [
      name,
      Object.fromEntries(letters.map((letter, i) => [columns[i], LEVEL_OF_LETTER[letter]])),
    ]),
  );
}

function readTexts(): Record<string, string> {
  const [, ...rows] = tableRows(section("## 5. Textos", "## 6."));
  return Object.fromEntries(rows);
}

function readDisclaimer(): string {
  const line = section("## 6. Aviso de uso", "## 7.")
    .split("\n")
    .find((text) => text.startsWith("> "));
  if (!line) throw new Error("Aviso de uso no encontrado");
  return line.slice(2);
}

/** Datos de docs/astrologia-reglas.md, la única fuente de verdad. */
export const SPEC = {
  signs: readSigns(),
  levels: readLevels(),
  matrix: readMatrix(),
  texts: readTexts(),
  disclaimer: readDisclaimer(),
};
