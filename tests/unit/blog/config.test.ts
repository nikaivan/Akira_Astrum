import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

const headersOf = async (source: string) => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((item) => item.source === source);
  return Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key.toLowerCase(), value]));
};

describe("cabeceras del blog público", () => {
  it.each(["/", "/blog/:path*", "/categorias/:path*"])("%s no se guarda en caché", async (source) => {
    expect((await headersOf(source))["cache-control"]).toMatch(/no-store/);
  });

  it.each(["/", "/blog/:path*", "/categorias/:path*"])("%s sigue siendo pública e indexable: sin noindex", async (source) => {
    expect(Object.keys(await headersOf(source))).not.toContain("x-robots-tag");
  });

  it("las reglas de la intranet y de la calculadora no cambian", async () => {
    expect((await headersOf("/login"))["x-robots-tag"]).toMatch(/noindex/);
    expect((await headersOf("/admin/:path*"))["x-robots-tag"]).toMatch(/noindex/);
    expect((await headersOf("/compatibilidad"))["cache-control"]).toMatch(/no-store/);
  });
});
