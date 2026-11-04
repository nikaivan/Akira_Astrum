import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// El checklist OWASP no puede citar nada que no exista ni esconder lo que falta (PLAN.md §5 y §11).
const root = (path: string) => new URL(`../../../${path}`, import.meta.url);
const CHECKLIST = "docs/owasp-checklist.md";
const text = existsSync(root(CHECKLIST)) ? readFileSync(root(CHECKLIST), "utf8") : "";

const CATEGORIES = [
  ["A01", "Broken Access Control"],
  ["A02", "Security Misconfiguration"],
  ["A03", "Software Supply Chain Failures"],
  ["A04", "Cryptographic Failures"],
  ["A05", "Injection"],
  ["A06", "Insecure Design"],
  ["A07", "Authentication Failures"],
  ["A08", "Software or Data Integrity Failures"],
  ["A09", "Security Logging and Alerting Failures"],
  ["A10", "Mishandling of Exceptional Conditions"],
] as const;
const STATES = { done: "✅ Hecho", partial: "⚠️ Parcial", missing: "❌ No hecho" } as const;

/** Secciones de segundo nivel: título → contenido. */
function sections(): Map<string, string> {
  const result = new Map<string, string>();
  const parts = text.split(/^## /m).slice(1);
  for (const part of parts) {
    const [title, ...body] = part.split("\n");
    result.set((title ?? "").trim(), body.join("\n"));
  }
  return result;
}
const sectionOf = (prefix: string) => [...sections()].find(([title]) => title.startsWith(prefix))?.[1] ?? "";

type Row = { category: string; measure: string; state: string; evidence: string; missing: string; verify: string };

/** Filas de datos de las tablas de cada categoría: | Medida | Estado | Evidencia | Qué falta | Cómo verificarlo |. */
function rows(): Row[] {
  const found: Row[] = [];
  for (const [code] of CATEGORIES) {
    const body = sectionOf(code);
    for (const line of body.split("\n")) {
      if (!line.startsWith("|") || /^\|\s*-{3}/.test(line) || /^\|\s*Medida\s*\|/.test(line)) continue;
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      if (cells.length !== 5) continue;
      const [measure, state, evidence, missing, verify] = cells as [string, string, string, string, string];
      found.push({ category: code, measure, state, evidence, missing, verify });
    }
  }
  return found;
}

const PATH_WORD = /^(tests|lib|app|docs|supabase|scripts|components|\.github)\/[^\s`]+$|^(proxy\.ts|next\.config\.ts|package\.json|\.gitignore)$/;
/** Rutas del repositorio citadas entre comillas invertidas (también dentro de un comando). */
function pathsIn(cell: string): string[] {
  const paths: string[] = [];
  for (const token of cell.matchAll(/`([^`]+)`/g)) {
    for (const word of (token[1] ?? "").split(/\s+/)) {
      const clean = word.replace(/[.,;:]+$/, "");
      if (PATH_WORD.test(clean)) paths.push(clean);
    }
  }
  return paths;
}

describe("estructura", () => {
  it("el checklist existe", () => {
    expect(text).not.toBe("");
  });

  it("tiene las diez categorías A01 a A10, en orden y con su nombre de OWASP Top 10:2025", () => {
    const titles = [...sections().keys()].filter((title) => /^A\d{2}\b/.test(title));
    expect(titles.map((title) => title.slice(0, 3))).toEqual(CATEGORIES.map(([code]) => code));
    for (const [code, name] of CATEGORIES) expect(titles.find((title) => title.startsWith(code))).toContain(name);
  });

  it("cada categoría tiene al menos una fila con las cinco columnas", () => {
    for (const [code] of CATEGORIES) expect(rows().filter((row) => row.category === code).length, code).toBeGreaterThan(0);
  });

  it("explica la leyenda de estados", () => {
    for (const state of Object.values(STATES)) expect(text).toContain(state);
  });
});

describe("estados y evidencias", () => {
  it("cada fila tiene un estado válido", () => {
    for (const row of rows()) expect(Object.values(STATES), `${row.category}: ${row.measure}`).toContain(row.state as never);
  });

  it("una fila «Hecho» cita al menos una evidencia y no declara nada pendiente", () => {
    for (const row of rows().filter((item) => item.state === STATES.done)) {
      expect(pathsIn(row.evidence).length, `${row.category}: ${row.measure}`).toBeGreaterThan(0);
      expect(row.missing, `${row.category}: ${row.measure}`).toBe("—");
    }
  });

  it("una fila «No hecho» no cita ninguna evidencia como si lo demostrara", () => {
    for (const row of rows().filter((item) => item.state === STATES.missing)) {
      expect(row.evidence, `${row.category}: ${row.measure}`).toBe("—");
      expect(pathsIn(row.evidence)).toEqual([]);
    }
  });

  it("todo «Parcial» y «No hecho» explica qué falta", () => {
    for (const row of rows().filter((item) => item.state !== STATES.done)) {
      expect(row.missing, `${row.category}: ${row.measure}`).not.toBe("—");
      expect(row.missing.length, `${row.category}: ${row.measure}`).toBeGreaterThan(10);
    }
  });

  it("cada categoría tiene al menos una fila «Hecho» o «Parcial»", () => {
    for (const [code] of CATEGORIES) {
      expect(rows().filter((row) => row.category === code && row.state !== STATES.missing).length, code).toBeGreaterThan(0);
    }
  });

  it("toda ruta citada existe en el repositorio (sin comodines)", () => {
    const missing: string[] = [];
    for (const row of rows()) {
      for (const path of [...pathsIn(row.evidence), ...pathsIn(row.verify)]) {
        if (path.includes("*") || !existsSync(root(path))) missing.push(`${row.category}: ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("los archivos de test citados contienen tests de verdad", () => {
    const empty: string[] = [];
    for (const row of rows()) {
      for (const path of pathsIn(row.evidence).filter((item) => /\.(test|spec)\.ts$/.test(item))) {
        if (existsSync(root(path)) && !/\b(it|test)(\.each)?\s*\(/.test(readFileSync(root(path), "utf8"))) empty.push(path);
      }
    }
    expect(empty).toEqual([]);
  });

  it("los ADR citados con ruta completa existen", () => {
    for (const adr of text.matchAll(/`(docs\/adr\/\d{4}-[^`\s]+\.md)`/g)) expect(existsSync(root(adr[1] ?? "")), adr[1]).toBe(true);
  });
});

describe("escaneo ZAP baseline", () => {
  const zap = sectionOf("Escaneo ZAP baseline");
  const state = /\*\*Estado:\*\*\s*(Pendiente de ejecutar|Ejecutado)/.exec(zap)?.[1];

  it("la sección existe y declara su estado", () => {
    expect(zap).not.toBe("");
    expect(state).toBeDefined();
  });

  it("explica cómo ejecutarlo (npm run zap) y sus límites (no escanea la intranet)", () => {
    expect(zap).toContain("`npm run zap`");
    expect(zap).toMatch(/intranet/i);
    expect(zap).toMatch(/baseline/i);
  });

  it("si está pendiente, no lleva fecha ni cifras de alertas", () => {
    if (state !== "Pendiente de ejecutar") return;
    expect(zap).not.toMatch(/\*\*Fecha:\*\*/);
    expect(zap).not.toMatch(/\b(altas?|medias?|bajas?|informativas?)\s+\d+\b|\b\d+\s+(altas?|medias?|bajas?|informativas?)\b/i);
  });

  it("si está ejecutado, lleva fecha, versión, recuento por nivel y ninguna alerta alta pendiente", () => {
    if (state !== "Ejecutado") return;
    expect(zap).toMatch(/\*\*Fecha:\*\*\s*\d{4}-\d{2}-\d{2}/);
    expect(zap).toMatch(/\*\*Versión de ZAP:\*\*\s*\S+/);
    expect(zap).toMatch(/\*\*Alertas:\*\*[^\n]*altas\s+\d+[^\n]*medias\s+\d+[^\n]*bajas\s+\d+/);
    expect(zap).toMatch(/\*\*Alertas altas pendientes:\*\*\s*0\b/);
  });
});

describe("resumen", () => {
  const summary = sectionOf("Resumen de lo no hecho");

  it("existe", () => {
    expect(summary).not.toBe("");
  });

  it("enumera cada medida «Parcial» o «No hecho» de las tablas: no se esconde nada", () => {
    const hidden = rows()
      .filter((row) => row.state !== STATES.done)
      .filter((row) => !summary.includes(row.measure))
      .map((row) => `${row.category}: ${row.measure}`);
    expect(hidden).toEqual([]);
  });

  it("no enumera nada que las tablas den por hecho", () => {
    const done = new Set(rows().filter((row) => row.state === STATES.done).map((row) => row.measure));
    const listed = summary
      .split("\n")
      .filter((line) => /^[-*]\s/.test(line))
      .filter((line) => [...done].some((measure) => line.includes(measure)));
    expect(listed).toEqual([]);
  });
});
