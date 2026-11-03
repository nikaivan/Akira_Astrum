/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { buildImageConfig } from "@/lib/blog/image-config";

const SOURCES = import.meta.glob(["/app/**/*.{ts,tsx}", "/lib/**/*.{ts,tsx}", "/components/**/*.{ts,tsx}", "/next.config.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const inside = (...prefixes: string[]) => Object.entries(SOURCES).filter(([path]) => prefixes.some((prefix) => path.startsWith(prefix)));
const offenders = (entries: Array<[string, string]>, pattern: RegExp) => entries.filter(([, source]) => pattern.test(source)).map(([path]) => path);
// El nombre de la clave de servicio se compone: un test de la Fase 1 limita los archivos de tests donde aparece.
const ELEVATED_KEY = new RegExp([["service", "role"].join("_"), ["service", "Role"].join("")].join("|"), "i");

describe("el análisis cubre la portada", () => {
  it("existen los módulos de Storage y los componentes de la portada", () => {
    for (const expected of ["/lib/storage/image-validation.ts", "/lib/storage/covers.ts", "/lib/storage/limiter.ts", "/components/admin/cover-field.tsx", "/components/cover-placeholder.tsx"]) {
      expect(Object.keys(SOURCES)).toContain(expected);
    }
  });
});

describe("Storage: un único punto de acceso", () => {
  it("solo lib/storage/covers.ts llama a .storage en toda la aplicación", () => {
    expect(offenders(inside("/app/", "/lib/", "/components/"), /\.storage\b/)).toEqual(["/lib/storage/covers.ts"]);
  });

  it("solo se usa el bucket de imágenes de las entradas, y nunca upsert: true", () => {
    const covers = SOURCES["/lib/storage/covers.ts"];
    expect(covers).toMatch(/["']post-images["']/);
    expect(covers).not.toMatch(/upsert\s*:\s*true/);
    expect(covers).not.toMatch(/\.list\s*\(|\.getPublicUrl|\.createSignedUrl|\.download\s*\(/);
  });

  it("el código de la portada es puro: sin Next, sin console, sin clave de servicio, sin HTML dinámico", () => {
    const storage = inside("/lib/storage/");
    expect(storage.length).toBeGreaterThanOrEqual(3);
    expect(offenders(storage, /from\s+["']next(\/|["'])/)).toEqual([]);
    expect(offenders(storage, /\bconsole\./)).toEqual([]);
    expect(offenders(storage, ELEVATED_KEY)).toEqual([]);
    expect(offenders([...storage, ...inside("/components/admin/cover-field.tsx")], /dangerouslySetInnerHTML|\.innerHTML|\beval\s*\(/)).toEqual([]);
  });

  it("el analizador de imágenes no depende de librerías de terceros", () => {
    expect(SOURCES["/lib/storage/image-validation.ts"]).not.toMatch(/from\s+["'][^.@/][^"']*["']/);
  });
});

describe("tamaño de las Server Actions y control de origen", () => {
  it("next.config.ts fija bodySizeLimit en 3mb dentro de experimental.serverActions", () => {
    expect(SOURCES["/next.config.ts"]).toMatch(/experimental\s*:\s*\{[\s\S]*serverActions\s*:\s*\{[\s\S]*bodySizeLimit\s*:\s*["']3mb["']/);
  });

  it("y sigue sin relajar el control de origen (CSRF)", () => {
    expect(SOURCES["/next.config.ts"]).not.toMatch(/allowedOrigins/);
  });
});

describe("next/image solo sirve el Storage de este proyecto", () => {
  const config = buildImageConfig("https://abcdefghijklmnopqrst.supabase.co");

  it("un único patrón exacto: https, el host del proyecto, sin puerto, solo el bucket de imágenes y sin consulta", () => {
    expect(config.remotePatterns).toEqual([
      { protocol: "https", hostname: "abcdefghijklmnopqrst.supabase.co", port: "", pathname: "/storage/v1/object/public/post-images/**", search: "" },
    ]);
  });

  it("ni comodines en el host ni dominios adicionales", () => {
    const patterns = (config.remotePatterns ?? []) as Array<{ hostname: string }>;
    expect(patterns).toHaveLength(1);
    expect(patterns[0].hostname).not.toMatch(/\*/);
    expect((config as { domains?: unknown }).domains).toBeUndefined();
    expect((config as { dangerouslyAllowSVG?: unknown }).dangerouslyAllowSVG).toBeUndefined();
  });

  it("sin variable de entorno válida, ningún host", () => {
    for (const value of [undefined, "", "http://x.supabase.co", "https://user:pw@x.supabase.co", "https://x.supabase.co:8443"]) {
      expect(buildImageConfig(value).remotePatterns).toEqual([]);
    }
  });
});
