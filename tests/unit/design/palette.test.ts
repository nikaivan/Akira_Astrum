/// <reference types="vite/client" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Identidad visual «noche y marfil»: los pares de colores se comprueban con la fórmula de contraste de WCAG 2, no a ojo.
 * Se leen los tokens del propio `globals.css`: lo que se prueba es lo que se sirve.
 */
const CSS = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

function block(selector: RegExp): Record<string, string> {
  const body = CSS.match(selector)?.[1] ?? "";
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}

const IVORY = block(/:root\s*\{([^}]*)\}/);
const NIGHT = block(/\[data-surface=["']night["']\]\s*\{([^}]*)\}/);

function channel(value: number) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((start) => channel(parseInt(hex.slice(start, start + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
const HEX = /^#[0-9a-f]{6}$/i;

// [texto o elemento, fondo, mínimo, qué es]
type Pair = [string, string, number, string];
const TEXT = 4.5; // texto normal (AA)
const LARGE = 3; // texto grande y componentes de interfaz: bordes de campos y foco (AA)
const BODY = 7; // texto principal: holgura por encima de AA

const LIGHT_PAIRS: Pair[] = [
  ["foreground", "background", BODY, "texto principal"],
  ["foreground", "card", BODY, "texto en tarjetas"],
  ["card-foreground", "card", BODY, "texto de tarjeta"],
  ["muted-foreground", "background", TEXT, "texto secundario"],
  ["muted-foreground", "card", TEXT, "texto secundario en tarjetas"],
  ["muted-foreground", "muted", TEXT, "texto secundario sobre fondo atenuado"],
  ["primary-foreground", "primary", TEXT, "texto de botón"],
  ["primary", "background", TEXT, "enlaces"],
  ["primary", "card", TEXT, "enlaces en tarjetas"],
  ["gold", "background", LARGE, "dorado: solo texto grande o decorativo"],
  ["gold", "card", LARGE, "dorado en tarjetas"],
  ["destructive", "background", TEXT, "errores"],
  ["destructive", "card", TEXT, "errores en tarjetas"],
  ["input", "background", LARGE, "borde de los campos"],
  ["input", "card", LARGE, "borde de los campos en tarjetas"],
  ["ring", "background", LARGE, "anillo de foco"],
];

const NIGHT_PAIRS: Pair[] = [
  ["foreground", "background", BODY, "texto principal"],
  ["card-foreground", "card", BODY, "texto de tarjeta"],
  ["muted-foreground", "background", TEXT, "texto secundario"],
  ["muted-foreground", "card", TEXT, "texto secundario en tarjetas"],
  ["primary-foreground", "primary", TEXT, "texto del botón dorado"],
  ["primary", "background", TEXT, "enlaces"],
  ["primary", "card", TEXT, "enlaces en tarjetas"],
  ["gold", "background", TEXT, "dorado como texto"],
  ["gold", "card", TEXT, "dorado como texto en tarjetas"],
  ["destructive", "background", TEXT, "errores"],
  ["destructive", "card", TEXT, "errores en tarjetas"],
  ["input", "background", LARGE, "borde de los campos"],
  ["input", "card", LARGE, "borde de los campos en tarjetas"],
  ["ring", "background", LARGE, "anillo de foco"],
  ["ring", "card", LARGE, "anillo de foco en tarjetas"],
];

describe("el análisis encuentra los tokens", () => {
  it("lee globals.css y sus dos ámbitos: marfil (por defecto) y noche", () => {
    expect(CSS.length).toBeGreaterThan(500);
    expect(Object.keys(IVORY).length).toBeGreaterThan(10);
    expect(Object.keys(NIGHT).length).toBeGreaterThan(10);
  });
});

describe("identidad: marfil por defecto y noche en su ámbito", () => {
  it("el fondo por defecto es marfil y el de la superficie noche es azul noche profundo", () => {
    expect(IVORY.background?.toLowerCase()).toBe("#fbf8f3");
    expect(NIGHT.background?.toLowerCase()).toBe("#0b1026");
    expect(luminance(NIGHT.background ?? "#ffffff")).toBeLessThan(0.02);
    expect(luminance(IVORY.background ?? "#000000")).toBeGreaterThan(0.9);
  });

  it("la superficie noche pinta su propio fondo y su texto (no solo redefine variables)", () => {
    const rule = CSS.match(/\[data-surface=["']night["']\]\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/background(-color)?\s*:\s*var\(--background\)/);
    expect(rule).toMatch(/(^|[;\s])color\s*:\s*var\(--foreground\)/);
  });

  it("el botón principal de la noche es dorado y el de marfil es índigo", () => {
    expect(NIGHT.primary?.toLowerCase()).toMatch(/^#d[0-9a-f]b[0-9a-f]7[0-9a-f]$/);
    expect(IVORY.primary?.toLowerCase()).toBe("#2e2e7a");
  });
});

describe.each([
  ["marfil", IVORY, LIGHT_PAIRS],
  ["noche", NIGHT, NIGHT_PAIRS],
] as const)("contraste WCAG (%s)", (_name, tokens, pairs) => {
  it.each(pairs)("%s sobre %s cumple %s:1 (%s)", (foreground, background, minimum) => {
    const fg = tokens[foreground]; // eslint-disable-line security/detect-object-injection -- claves cerradas
    const bg = tokens[background]; // eslint-disable-line security/detect-object-injection -- claves cerradas
    expect(fg, `--${foreground}`).toMatch(HEX);
    expect(bg, `--${background}`).toMatch(HEX);
    expect(contrast(fg as string, bg as string)).toBeGreaterThanOrEqual(minimum);
  });
});

describe("el panel de administración sigue en claro", () => {
  const ADMIN = import.meta.glob(["/app/admin/**/*.{ts,tsx}", "/components/admin/**/*.{ts,tsx}"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

  it("ningún archivo del panel usa la superficie noche", () => {
    expect(Object.keys(ADMIN).length).toBeGreaterThan(10);
    expect(Object.entries(ADMIN).filter(([, source]) => /data-surface/.test(source)).map(([path]) => path)).toEqual([]);
  });
});
