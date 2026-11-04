import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { staticSecurityHeaders } from "@/lib/security/headers";

// ZAP baseline (Fase 3, E): `Cross-Origin-Resource-Policy` faltaba en los archivos de /_next/static. Se añade same-origin.
// `Cross-Origin-Embedder-Policy` se acepta como ausente: solo sirve para aislar el origen (SharedArrayBuffer), que no se usa, y
// exigiría que todo recurso de terceros declarase su propia política.
const asMap = (headers: readonly { key: string; value: string }[]) => Object.fromEntries(headers.map(({ key, value }) => [key.toLowerCase(), value]));

describe.each([
  ["desarrollo", false],
  ["producción", true],
])("cabeceras estáticas en %s", (_name, isProd) => {
  const headers = asMap(staticSecurityHeaders(isProd));

  it("Cross-Origin-Resource-Policy: same-origin (nadie puede incrustar nuestros recursos desde otro sitio)", () => {
    expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
  });

  it("no se activa Cross-Origin-Embedder-Policy (decisión documentada: se acepta el aviso bajo de ZAP)", () => {
    expect(headers["cross-origin-embedder-policy"]).toBeUndefined();
  });

  it("sigue el aislamiento de la ventana (Cross-Origin-Opener-Policy: same-origin)", () => {
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  });
});

describe("next.config", () => {
  it("aplica la política a todas las rutas, también a /_next/static", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = asMap(rules.find((rule) => rule.source === "/(.*)")?.headers ?? []);
    expect(all["cross-origin-resource-policy"]).toBe("same-origin");
  });
});
