import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

const headersOf = async (source: string) => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((item) => item.source === source);
  return Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key.toLowerCase(), value]));
};

describe("cabeceras de /compatibilidad", () => {
  it("no se guarda en caché", async () => {
    expect((await headersOf("/compatibilidad"))["cache-control"]).toMatch(/no-store/);
  });

  it("sigue siendo pública e indexable: no lleva noindex", async () => {
    const headers = await headersOf("/compatibilidad");
    expect(Object.keys(headers)).not.toContain("x-robots-tag");
  });

  it("las reglas privadas de la intranet no cambian", async () => {
    expect((await headersOf("/login"))["x-robots-tag"]).toMatch(/noindex/);
    expect((await headersOf("/admin/:path*"))["x-robots-tag"]).toMatch(/noindex/);
  });
});
