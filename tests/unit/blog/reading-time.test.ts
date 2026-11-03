import { describe, expect, it } from "vitest";
import { readingMinutes } from "@/lib/blog/reading-time";
import { words } from "./support";

describe("readingMinutes (200 palabras por minuto, mínimo 1)", () => {
  it.each([
    [0, 1],
    [1, 1],
    [199, 1],
    [200, 1],
    [201, 2],
    [400, 2],
    [401, 3],
    [1000, 5],
  ])("%i palabras → %i min", (count, minutes) => {
    expect(readingMinutes(words(count))).toBe(minutes);
  });

  it.each(["", "   \n\n  ", "***", "---", "# ", "> ", "```\n```"])("el contenido vacío o solo de marcas (%j) cuenta 1 minuto", (source) => {
    expect(readingMinutes(source)).toBe(1);
  });

  it("no cuenta las marcas de Markdown ni las direcciones como palabras", () => {
    const decorated = `# ${words(100)}\n\n**${words(50)}**\n\n- [${words(50)}](https://ejemplo.test/una/ruta/muy/larga)\n`;
    expect(readingMinutes(decorated)).toBe(1); // 200 palabras reales
    expect(readingMinutes(`${decorated}\npalabra\n`)).toBe(2); // la 201.ª
  });

  it("cuenta las palabras con acentos y eñes", () => {
    expect(readingMinutes(`${"ñandú café corazón ".repeat(67)}`)).toBe(2); // 201 palabras
  });

  it("no tarda de forma exponencial con entradas hostiles", () => {
    const hostile = ["a".repeat(1_000_000), "[".repeat(200_000), "*".repeat(200_000), "(".repeat(100_000) + "x".repeat(100_000), " ".repeat(500_000)];
    const start = performance.now();
    for (const source of hostile) readingMinutes(source);
    expect(performance.now() - start).toBeLessThan(1500);
  });
});
