import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

const data = manifest();
const publicFile = (src: string) => readFileSync(new URL(`../../../public${src}`, import.meta.url));
const PNG_SIGNATURE = "89504e470d0a1a0a";

type Icon = { src: string; sizes?: string; type?: string; purpose?: string };
const icons = (data.icons ?? []) as Icon[];

describe("manifiesto: identidad y arranque", () => {
  it("nombre y nombre corto", () => {
    expect(data.name).toBe("Akira Astrum");
    expect(data.short_name).toBe("Akira Astrum");
    expect((data.short_name ?? "").length).toBeLessThanOrEqual(12);
  });

  it("describe la aplicación en español", () => {
    expect(data.lang).toBe("es");
    expect((data.description ?? "").length).toBeGreaterThan(10);
  });

  it("se abre como aplicación (standalone) en la raíz pública del sitio", () => {
    expect(data.display).toBe("standalone");
    expect(data.start_url).toBe("/");
    expect(data.scope).toBe("/");
    expect(data.id).toBe("/");
  });

  it("colores: tema noche y fondo marfil (docs/design.md §6 bis)", () => {
    expect(data.theme_color).toBe("#0B1026");
    expect(data.background_color).toBe("#FBF8F3");
  });

  it("no contiene datos sensibles ni rutas de la intranet", () => {
    expect(JSON.stringify(data)).not.toMatch(/\/admin|\/login|supabase|token|key|secret|@/i);
  });
});

describe("manifiesto: iconos", () => {
  it("incluye 192 y 512 normales y uno enmascarable", () => {
    const find = (sizes: string, purpose: string) => icons.find((icon) => icon.sizes === sizes && (icon.purpose ?? "any") === purpose);
    expect(find("192x192", "any")).toBeDefined();
    expect(find("512x512", "any")).toBeDefined();
    expect(find("512x512", "maskable")).toBeDefined();
  });

  it("los enmascarables no se mezclan con los normales (un icono por propósito)", () => {
    for (const icon of icons) expect(icon.purpose ?? "any").toMatch(/^(any|maskable)$/);
  });

  it.each(icons.map((icon) => [icon.src, icon] as const))("%s existe en public/, es un PNG y mide lo que declara", (src, icon) => {
    expect(src).toMatch(/^\/[a-z0-9-]+\.png$/);
    expect(icon.type).toBe("image/png");
    const bytes = publicFile(src);
    expect(bytes.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
    const [width, height] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    expect(`${width}x${height}`).toBe(icon.sizes);
  });
});
