/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

const RAW = import.meta.glob(["/app/layout.tsx", "/app/globals.css", "/components/site-header.tsx", "/components/site-footer.tsx", "/components/admin/admin-nav.tsx", "/components/service-worker-register.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const source = (path: string) => RAW[path] ?? "";

describe("viewport y color de tema", () => {
  const layout = source("/app/layout.tsx");

  it("el layout exporta viewport con el tema noche y viewport-fit=cover", () => {
    expect(layout).toMatch(/export const viewport/);
    expect(layout).toMatch(/themeColor:\s*"#0B1026"/);
    expect(layout).toMatch(/viewportFit:\s*"cover"/);
    expect(layout).toMatch(/width:\s*"device-width"/);
  });

  it("monta el registro del service worker", () => {
    expect(layout).toMatch(/<ServiceWorkerRegister\s*\/>/);
  });
});

describe("registro del service worker (componente)", () => {
  const component = source("/components/service-worker-register.tsx");

  it("es un componente de cliente que registra tras la carga y no pinta nada", () => {
    expect(component).toMatch(/^["']use client["']/);
    expect(component).toMatch(/registerServiceWorker/);
    expect(component).toMatch(/"load"/);
    expect(component).toMatch(/return null/);
  });
});

describe("zonas seguras de la pantalla (muescas y barras del sistema)", () => {
  it("globals.css define los cuatro márgenes seguros", () => {
    const css = source("/app/globals.css");
    for (const side of ["top", "bottom", "left", "right"]) expect(css).toContain(`env(safe-area-inset-${side}`);
  });

  it.each(["/components/site-header.tsx", "/components/site-footer.tsx", "/components/admin/admin-nav.tsx"])("%s respeta las zonas seguras", (path) => {
    expect(source(path)).toMatch(/safe-/);
  });
});

describe("cabeceras del service worker", () => {
  async function headersOf(path: string) {
    const rules = (await nextConfig.headers?.()) ?? [];
    const rule = rules.find((item) => item.source === path);
    return Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key.toLowerCase(), value]));
  }

  it("/sw.js se revalida siempre (sin caché larga) y se sirve como JavaScript", async () => {
    const headers = await headersOf("/sw.js");
    expect(headers["cache-control"]).toBe("no-cache");
    expect(headers["content-type"]).toBe("application/javascript; charset=utf-8");
  });

  it("las reglas anteriores siguen en pie", async () => {
    const sources = ((await nextConfig.headers?.()) ?? []).map((rule) => rule.source);
    for (const expected of ["/(.*)", "/login", "/admin/:path*", "/compatibilidad", "/"]) expect(sources).toContain(expected);
  });
});
