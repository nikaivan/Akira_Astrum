import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/offline/route";

const css = readFileSync(new URL("../../../public/offline.css", import.meta.url), "utf8");

async function page() {
  const response = await GET();
  return { response, html: await response.text() };
}

describe("/offline", () => {
  it("responde 200 con HTML en español, sin indexar y sin caché HTTP larga", async () => {
    const { response } = await page();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("x-robots-tag")).toMatch(/noindex/);
    expect(response.headers.get("cache-control")).toBe("no-cache");
  });

  it("explica que no hay conexión, con un solo h1 y un enlace de vuelta", async () => {
    const { html } = await page();
    expect(html).toMatch(/<html lang="es"/);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain("Sin conexión");
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*>[^<]*portada/i);
    expect(html).toMatch(/<meta name="robots" content="noindex/);
    expect(html).toMatch(/<meta name="viewport"[^>]*viewport-fit=cover/);
  });

  it("es autocontenida y compatible con la CSP: sin scripts, sin estilos en línea y sin recursos externos", async () => {
    const { html } = await page();
    expect(html).not.toMatch(/<script|<style|\sstyle=|\son[a-z]+=|<iframe|<img|<link[^>]*(http|\/\/)/i);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain('href="/offline.css"');
  });

  it("no enlaza ni nombra la intranet", async () => {
    const { html } = await page();
    expect(html).not.toMatch(/\/admin|\/login|intranet/i);
  });
});

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};
const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1] ?? "";

describe("offline.css", () => {
  it("usa la superficie noche con los mismos colores que el sitio", () => {
    expect(token("bg").toUpperCase()).toBe("#0B1026");
    expect(token("fg").toUpperCase()).toBe("#F4EFE6");
  });

  it("aplica los tokens al cuerpo y no carga recursos externos", () => {
    expect(css).toMatch(/background:\s*var\(--bg\)/);
    expect(css).toMatch(/\bcolor:\s*var\(--fg\)/);
    expect(css).not.toMatch(/@import|url\(/);
  });

  it("cumple el contraste: texto ≥ 7:1 y secundario y dorado ≥ 4,5:1 sobre el fondo", () => {
    expect(contrast(token("fg"), token("bg"))).toBeGreaterThanOrEqual(7);
    expect(contrast(token("muted"), token("bg"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("gold"), token("bg"))).toBeGreaterThanOrEqual(4.5);
  });

  it("el enlace tiene objetivo táctil de al menos 44 px y foco visible", () => {
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/:focus-visible/);
  });
});
