import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { staticSecurityHeaders } from "@/lib/security/headers";

const asMap = (headers: readonly { key: string; value: string }[]) => Object.fromEntries(headers.map(({ key, value }) => [key.toLowerCase(), value]));

describe("staticSecurityHeaders", () => {
  const headers = asMap(staticSecurityHeaders(false));

  it("impide que el navegador adivine el tipo de contenido", () => {
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  it("limita el Referer enviado a otros sitios", () => {
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("impide incrustar la web en marcos (también en navegadores sin frame-ancestors)", () => {
    expect(headers["x-frame-options"]).toBe("DENY");
  });

  it("aísla la ventana de otros orígenes", () => {
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  });

  it.each(["camera", "microphone", "geolocation", "payment", "usb", "interest-cohort"])("Permissions-Policy deniega %s", (feature) => {
    expect(headers["permissions-policy"]).toContain(`${feature}=()`);
  });

  it("HSTS no se envía fuera de producción (rompería http://localhost)", () => {
    expect(headers["strict-transport-security"]).toBeUndefined();
  });

  it("HSTS en producción: al menos un año, con subdominios y sin preload", () => {
    const value = asMap(staticSecurityHeaders(true))["strict-transport-security"];
    const maxAge = Number(/max-age=(\d+)/.exec(value ?? "")?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
    expect(value).toContain("includeSubDomains");
    expect(value).not.toContain("preload");
  });

  it("la CSP no está aquí: depende del nonce de cada petición y la pone el proxy", () => {
    expect(headers["content-security-policy"]).toBeUndefined();
  });
});

describe("next.config", () => {
  it("no anuncia la tecnología del servidor (X-Powered-By)", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("aplica las cabeceras estáticas a todas las rutas", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((rule) => rule.source === "/(.*)");
    const applied = asMap(all?.headers ?? []);
    const expected = asMap(staticSecurityHeaders(process.env.NODE_ENV === "production"));
    expect(Object.keys(expected).length).toBeGreaterThanOrEqual(5);
    expect(applied).toEqual(expected);
  });

  it("conserva las reglas de privacidad y caché ya existentes", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const sources = rules.map((rule) => rule.source);
    for (const source of ["/login", "/admin/:path*", "/compatibilidad", "/", "/blog/:path*", "/categorias/:path*"]) expect(sources).toContain(source);
  });
});
