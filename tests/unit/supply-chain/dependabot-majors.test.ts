import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Los saltos mayores no viajan en la PR semanal agrupada: un parche inocuo no debe quedar bloqueado por un salto mayor
// que el ecosistema todavía no soporta (la PR #26 mezcló react 19.3.1 con TypeScript 7 y eslint-config-next no lo admite).
const config = readFileSync(new URL("../../../.github/dependabot.yml", import.meta.url), "utf8");

/** Bloque de un ecosistema: desde su «package-ecosystem» hasta el siguiente o el final. */
function block(ecosystem: string): string {
  const parts = config.split(/^\s*-\s+package-ecosystem:/m).slice(1);
  return parts.find((part) => part.trimStart().startsWith(ecosystem)) ?? "";
}
const groupsSection = (text: string) => /groups:([\s\S]*?)(?=\n\s{4}ignore:|\n\s{2}-\s|$)/.exec(text)?.[1] ?? "";

describe.each(["npm", "github-actions"])("Dependabot (%s): agrupación", (ecosystem) => {
  const text = block(ecosystem);

  it("existe el bloque del ecosistema", () => {
    expect(text).not.toBe("");
  });

  it("el grupo solo reúne actualizaciones menores y de parche", () => {
    const groups = groupsSection(text);
    expect(groups).toMatch(/update-types:\s*\[\s*"minor"\s*,\s*"patch"\s*\]/);
    expect(groups).not.toMatch(/major/);
  });

  it("no hay ningún grupo que acepte cualquier tipo de actualización", () => {
    const groups = groupsSection(text);
    const names = groups.match(/^\s{6}[a-z0-9-]+:\s*$/gm) ?? [];
    const withTypes = groups.match(/update-types:/g) ?? [];
    expect(names.length).toBeGreaterThan(0);
    expect(withTypes).toHaveLength(names.length);
  });
});

describe("Dependabot (npm): los saltos mayores se hacen a mano", () => {
  const text = block("npm");

  it("ignora los saltos mayores de todas las dependencias", () => {
    expect(text).toMatch(/ignore:/);
    expect(text).toMatch(/dependency-name:\s*"\*"/);
    expect(text).toMatch(/update-types:\s*\[\s*"version-update:semver-major"\s*\]/);
  });
});

describe("Dependabot (github-actions): los saltos mayores llegan aparte", () => {
  it("no se ignoran: una acción nueva se revisa en su propia PR", () => {
    expect(block("github-actions")).not.toMatch(/ignore:/);
  });
});
