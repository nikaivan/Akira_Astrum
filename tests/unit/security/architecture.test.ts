/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const SECURITY = import.meta.glob("/lib/security/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("lib/security", () => {
  it("existen los módulos esperados", () => {
    expect(Object.keys(SECURITY).sort()).toEqual(expect.arrayContaining(["/lib/security/csp.ts", "/lib/security/headers.ts"]));
  });

  it("no usa console (nada de la política se vuelca a los logs) ni la clave de rol de servicio", () => {
    for (const [path, source] of Object.entries(SECURITY)) {
      expect(source, path).not.toMatch(/\bconsole\./);
      expect(source, path).not.toMatch(/service.?role/i);
    }
  });

  it("la CSP no contiene unsafe-inline para scripts ni comodines escritos a mano", () => {
    const source = SECURITY["/lib/security/csp.ts"] ?? "";
    expect(source).not.toMatch(/script-src[^;`"]*unsafe-inline/);
    expect(source).not.toMatch(/https?:\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}/i);
  });
});
