/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const SOURCES = import.meta.glob(["/app/compatibilidad/**/*.{ts,tsx}", "/lib/compatibility/**/*.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const EXPECTED = [
  "/lib/compatibility/schema.ts",
  "/lib/compatibility/calculate.ts",
  "/lib/compatibility/limiter.ts",
  "/lib/compatibility/messages.ts",
  "/lib/compatibility/actions.ts",
  "/app/compatibilidad/page.tsx",
  "/app/compatibilidad/compatibility-form.tsx",
  "/app/compatibilidad/compatibility-result.tsx",
];

const matching = (pattern: RegExp) =>
  Object.entries(SOURCES)
    .filter(([, source]) => pattern.test(source))
    .map(([path]) => path)
    .sort();

describe("el análisis cubre los archivos esperados", () => {
  it("encuentra todo el código de la calculadora", () => {
    expect(Object.keys(SOURCES).sort()).toEqual([...EXPECTED].sort());
  });
});

describe("nada se guarda, se registra ni se envía fuera (A06, privacidad)", () => {
  it.each([
    ["Supabase", /supabase/i],
    ["la clave de servicio de Supabase", /service[_]role/i],
    ["console", /\bconsole\s*\./],
    ["fetch / XMLHttpRequest / sendBeacon / WebSocket", /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/],
    ["localStorage / sessionStorage / IndexedDB", /localStorage|sessionStorage|indexedDB/i],
    ["cookies", /\bcookies\s*\(|document\.cookie|Set-Cookie/i],
    ["la URL como canal de datos", /searchParams|useSearchParams|window\.location|location\.(search|href|hash)|history\.(push|replace)State|router\.(push|replace)/],
    ["router de Next", /next\/navigation/],
    ["escritura de ficheros", /node:fs|from ["']fs["']|writeFile/],
  ])("no usa %s", (_nombre, pattern) => {
    expect(matching(pattern)).toEqual([]);
  });

  it("el formulario no se envía por GET", () => {
    expect(matching(/method\s*=\s*["']?get/i)).toEqual([]);
    expect(SOURCES["/app/compatibilidad/compatibility-form.tsx"]).toMatch(/<form[^>]*action=\{/);
  });
});

describe("los textos se pintan como texto (A05)", () => {
  it("no usa dangerouslySetInnerHTML, innerHTML ni eval", () => {
    expect(matching(/dangerouslySetInnerHTML|\.innerHTML|insertAdjacentHTML|\beval\s*\(|new Function/)).toEqual([]);
  });
});

describe("el dominio no se reescribe: los datos salen de lib/astrology/", () => {
  it("no hay nombres de signos, elementos ni textos del dominio en el código de la calculadora", () => {
    const signNames = /Aries|Tauro|Géminis|Cáncer|Escorpio|Sagitario|Capricornio|Acuario|Piscis|Libra|Virgo|\bLeo\b/;
    expect(matching(signNames)).toEqual([]);
    expect(matching(/base científica|tradición astrológica/)).toEqual([]);
  });

  it("la lógica reutiliza el dominio y el limitador del login", () => {
    expect(SOURCES["/lib/compatibility/calculate.ts"]).toMatch(/@\/lib\/astrology\/sun-sign/);
    expect(SOURCES["/lib/compatibility/calculate.ts"]).toMatch(/@\/lib\/astrology\/compatibility/);
    expect(SOURCES["/lib/compatibility/schema.ts"]).toMatch(/@\/lib\/astrology\/birth-date/);
    expect(SOURCES["/lib/compatibility/limiter.ts"]).toMatch(/createRateLimiter/);
    expect(SOURCES["/lib/compatibility/limiter.ts"]).toMatch(/@\/lib\/auth\/rate-limit/);
  });

  it("el aviso de uso sale de los datos del dominio", () => {
    expect(matching(/DISCLAIMER/).some((path) => path.startsWith("/app/compatibilidad/"))).toBe(true);
  });
});

describe("la Server Action es pública y no usa sesión", () => {
  it("el único 'use server' de la calculadora es lib/compatibility/actions.ts", () => {
    expect(matching(/^\s*["']use server["']/m)).toEqual(["/lib/compatibility/actions.ts"]);
  });

  it("no depende del login ni de la intranet", () => {
    expect(matching(/requireAdmin|withAdmin|@\/lib\/auth\/(actions|require-admin|authorize|login)/)).toEqual([]);
  });
});
