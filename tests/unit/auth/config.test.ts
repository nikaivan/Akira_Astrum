import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { config as proxyConfig } from "@/proxy";

describe("configuración de la intranet", () => {
  it("el proxy se ejecuta en todas las rutas de /admin", () => {
    const matchers = ([] as unknown[]).concat(proxyConfig.matcher);
    expect(matchers).toContain("/admin/:path*");
  });

  it.each(["/login", "/admin/:path*"])("%s se sirve con noindex y sin caché", async (source) => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const rule = rules.find((item) => item.source === source);
    const headers = Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key.toLowerCase(), value]));

    expect(headers["x-robots-tag"]).toMatch(/noindex/);
    expect(headers["x-robots-tag"]).toMatch(/nofollow/);
    expect(headers["cache-control"]).toMatch(/no-store/);
  });
});
