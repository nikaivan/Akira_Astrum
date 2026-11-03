/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const SOURCES = import.meta.glob(
  [
    "/app/page.tsx",
    "/app/not-found.tsx",
    "/app/error.tsx",
    "/app/blog/**/*.{ts,tsx}",
    "/app/categorias/**/*.{ts,tsx}",
    "/lib/blog/**/*.ts",
    "/lib/markdown/**/*.ts",
    "/lib/supabase/public.ts",
    "/components/markdown.tsx",
    "/components/post-card.tsx",
    "/components/post-article.tsx",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const PACKAGE = Object.values(
  import.meta.glob("/package.json", { query: "?raw", import: "default", eager: true }) as Record<string, string>,
)[0];
const SLUG_LIB = Object.values(
  import.meta.glob("/lib/posts/slug.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>,
)[0];

const EXPECTED = [
  "/app/page.tsx",
  "/app/not-found.tsx",
  "/app/error.tsx",
  "/app/blog/page.tsx",
  "/app/blog/[slug]/page.tsx",
  "/app/categorias/[slug]/page.tsx",
  "/lib/blog/queries.ts",
  "/lib/blog/reading-time.ts",
  "/lib/blog/excerpt.ts",
  "/lib/blog/dates.ts",
  "/lib/blog/cover.ts",
  "/lib/blog/image-config.ts",
  "/lib/blog/metadata.ts",
  "/lib/markdown/sanitize-schema.ts",
  "/lib/supabase/public.ts",
  "/components/markdown.tsx",
  "/components/post-card.tsx",
  "/components/post-article.tsx",
];

const PUBLIC_PAGES = ["/app/page.tsx", "/app/blog/page.tsx", "/app/blog/[slug]/page.tsx", "/app/categorias/[slug]/page.tsx"];
const SLUG_PAGES = ["/app/blog/[slug]/page.tsx", "/app/categorias/[slug]/page.tsx"];

const matching = (pattern: RegExp, paths: string[] = Object.keys(SOURCES)) =>
  paths.filter((path) => pattern.test(Reflect.get(SOURCES, path) as string)).sort();
const source = (path: string) => Reflect.get(SOURCES, path) as string;

describe("el análisis cubre los archivos esperados", () => {
  it("encuentra todo el código del blog", () => {
    expect(Object.keys(SOURCES).sort()).toEqual([...EXPECTED].sort());
  });
});

describe("el contenido se pinta como texto, no como HTML (A05)", () => {
  it.each([
    ["dangerouslySetInnerHTML", /dangerouslySetInnerHTML/],
    ["innerHTML / insertAdjacentHTML / eval", /\.innerHTML|insertAdjacentHTML|\beval\s*\(|new Function/],
    ["rehype-raw o HTML crudo permitido", /rehype-raw|allowDangerousHtml|skipHtml\s*=\s*\{?\s*false/],
    ["la lista blanca por defecto de rehype-sanitize", /defaultSchema/],
  ])("no usa %s", (_nombre, pattern) => {
    expect(matching(pattern)).toEqual([]);
  });

  it("el Markdown pasa por react-markdown y rehype-sanitize, y solo desde components/markdown.tsx", () => {
    expect(matching(/from ["']react-markdown["']/)).toEqual(["/components/markdown.tsx"]);
    expect(matching(/from ["']rehype-sanitize["']/)).toEqual(["/components/markdown.tsx"]);
    expect(source("/components/markdown.tsx")).toMatch(/sanitize-schema/);
  });
});

describe("las páginas públicas leen con la clave pública y sin cookies (A01)", () => {
  it("usan createPublicClient", () => {
    expect(matching(/createPublicClient/, PUBLIC_PAGES)).toEqual([...PUBLIC_PAGES].sort());
  });

  it.each([
    ["el cliente con cookies de sesión", /@\/lib\/supabase\/server/],
    ["el cliente del navegador", /@\/lib\/supabase\/client/],
    ["la clave de servicio de Supabase", /service[_]role/i],
    ["cookies() ni headers()", /\bcookies\s*\(|\bheaders\s*\(/],
    ["console", /\bconsole\s*\./],
  ])("el blog no usa %s", (_nombre, pattern) => {
    expect(matching(pattern)).toEqual([]);
  });

  it("el cliente público no guarda sesión", () => {
    expect(source("/lib/supabase/public.ts")).toMatch(/persistSession:\s*false/);
    expect(source("/lib/supabase/public.ts")).toMatch(/autoRefreshToken:\s*false/);
    expect(source("/lib/supabase/public.ts")).not.toMatch(/@supabase\/ssr/);
  });
});

describe("sin caché: nunca se sirve un borrador ni una entrada despublicada desde caché", () => {
  it("cada página pública es dinámica", () => {
    expect(matching(/export const dynamic\s*=\s*["']force-dynamic["']/, PUBLIC_PAGES)).toEqual([...PUBLIC_PAGES].sort());
  });

  it.each([
    ["unstable_cache", /unstable_cache/],
    ["revalidate / revalidatePath / revalidateTag", /\brevalidate(Path|Tag)?\b/],
    ["force-cache o use cache", /force-cache|["']use cache["']/],
    ["generateStaticParams", /generateStaticParams/],
    ["fetch directo", /\bfetch\s*\(/],
  ])("el blog no usa %s", (_nombre, pattern) => {
    expect(matching(pattern)).toEqual([]);
  });
});

describe("404 único y slug validado antes de consultar", () => {
  it("las páginas con slug llaman a notFound", () => {
    expect(matching(/notFound\s*\(/, SLUG_PAGES)).toEqual([...SLUG_PAGES].sort());
  });

  it("las consultas reutilizan isValidSlug del módulo de slugs y no copian su regla", () => {
    expect(SLUG_LIB).toMatch(/export function isValidSlug/);
    expect(source("/lib/blog/queries.ts")).toMatch(/isValidSlug/);
    expect(source("/lib/blog/queries.ts")).toMatch(/@\/lib\/posts\/slug/);
    expect(matching(/\[a-z0-9\]\+/)).toEqual([]);
  });

  it("una infraestructura caída no se convierte en notFound: las páginas distinguen el error", () => {
    expect(matching(/status\s*===?\s*["']error["']|["']error["']/, SLUG_PAGES)).toEqual([...SLUG_PAGES].sort());
  });
});

describe("dependencias fijadas (A03)", () => {
  it.each(["react-markdown", "rehype-sanitize"])("%s tiene versión exacta en dependencies", (name) => {
    const dependencies = (JSON.parse(PACKAGE) as { dependencies: Record<string, string> }).dependencies;
    expect(Reflect.get(dependencies, name)).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
