/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const SECURITY = import.meta.glob("/lib/security/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const APP_CODE = import.meta.glob(["/app/**/*.{ts,tsx}", "/lib/**/*.ts", "/components/**/*.{ts,tsx}", "/proxy.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const LAYOUT = (import.meta.glob("/app/layout.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>)["/app/layout.tsx"] ?? "";

describe("lib/security", () => {
  it("existen los módulos esperados", () => {
    expect(Object.keys(SECURITY).sort()).toEqual(expect.arrayContaining(["/lib/security/csp.ts", "/lib/security/headers.ts", "/lib/security/events.ts", "/lib/security/client-id.ts", "/lib/security/log.ts"]));
  });

  it("no usa la clave de rol de servicio", () => {
    for (const [path, source] of Object.entries(SECURITY)) expect(source, path).not.toMatch(/service.?role/i);
  });

  // La única salida a la consola es el registro de eventos; todo lo demás es puro.
  it("solo lib/security/log.ts escribe en la consola", () => {
    for (const [path, source] of Object.entries(SECURITY)) {
      if (path === "/lib/security/log.ts") continue;
      expect(source, path).not.toMatch(/\bconsole\b|process\.std(out|err)/);
    }
  });

  it("la CSP no contiene unsafe-inline para scripts ni comodines escritos a mano", () => {
    const source = SECURITY["/lib/security/csp.ts"] ?? "";
    expect(source).not.toMatch(/script-src[^;`"]*unsafe-inline/);
    expect(source).not.toMatch(/https?:\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it("en todo el código de la aplicación, solo el registro de eventos escribe en la consola", () => {
    expect(Object.keys(APP_CODE).length).toBeGreaterThan(50);
    const offenders = Object.entries(APP_CODE)
      .filter(([path, source]) => path !== "/lib/security/log.ts" && /\bconsole\s*\.|process\.std(out|err)/.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("el layout raíz fuerza el renderizado dinámico: sin él, las páginas estáticas no recibirían el nonce de la CSP", () => {
    expect(LAYOUT).toMatch(/export const dynamic = "force-dynamic"/);
  });
});
