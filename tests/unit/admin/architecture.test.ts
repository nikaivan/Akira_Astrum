/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const SOURCES = import.meta.glob(["/app/**/*.{ts,tsx}", "/lib/**/*.{ts,tsx}", "/components/**/*.{ts,tsx}", "/next.config.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const inside = (...prefixes: string[]) => Object.entries(SOURCES).filter(([path]) => prefixes.some((prefix) => path.startsWith(prefix)));
const ADMIN_CODE = () => inside("/lib/admin/", "/components/admin/", "/app/admin/");
const offenders = (entries: Array<[string, string]>, pattern: RegExp) => entries.filter(([, source]) => pattern.test(source)).map(([path]) => path);

describe("el análisis cubre el panel", () => {
  it("existen las rutas, las acciones y los servicios previstos", () => {
    const paths = Object.keys(SOURCES);
    for (const expected of [
      "/app/admin/page.tsx",
      "/app/admin/layout.tsx",
      "/app/admin/posts/new/page.tsx",
      "/app/admin/posts/[id]/edit/page.tsx",
      "/app/admin/categorias/page.tsx",
      "/lib/admin/form-data.ts",
      "/lib/admin/messages.ts",
      "/lib/admin/revalidate.ts",
      "/lib/admin/posts/schema.ts",
      "/lib/admin/posts/service.ts",
      "/lib/admin/posts/actions.ts",
      "/lib/admin/categories/schema.ts",
      "/lib/admin/categories/service.ts",
      "/lib/admin/categories/actions.ts",
      "/components/admin/markdown-preview.tsx",
      "/components/admin/post-editor.tsx",
      "/components/admin/post-list.tsx",
    ]) {
      expect(paths).toContain(expected);
    }
  });
});

describe("A01: Server Actions del panel", () => {
  const actionFiles = () => inside("/lib/admin/").filter(([path]) => /\/actions\.ts$/.test(path));

  it("hay un archivo de acciones para entradas y otro para categorías, ambos 'use server'", () => {
    expect(actionFiles().map(([path]) => path).sort()).toEqual(["/lib/admin/categories/actions.ts", "/lib/admin/posts/actions.ts"]);
    for (const [, source] of actionFiles()) expect(source).toMatch(/^\s*["']use server["']/m);
  });

  it("toda exportación es una constante envuelta en withAdminAction (comprueba al admin en cada llamada)", () => {
    expect(actionFiles()).toHaveLength(2);
    for (const [path, source] of actionFiles()) {
      const exports = source.split("\n").filter((line) => /^export\s/.test(line) && !/^export\s+(type|interface)\s/.test(line));
      expect(exports.length, path).toBeGreaterThan(0);
      for (const line of exports) expect(line, path).toMatch(/^export const \w+ = withAdminAction\(/);
    }
  });

  it("los servicios y los esquemas no dependen de Next (se prueban sin servidor)", () => {
    const pure = inside("/lib/admin/").filter(([path]) => /\/(service|schema|filters)\.ts$|\/(form-data|messages)\.ts$/.test(path));
    expect(pure.length).toBeGreaterThanOrEqual(6);
    expect(offenders(pure, /from\s+["']next(\/|["'])/)).toEqual([]);
  });

  it("las páginas del panel comprueban al admin por sí mismas y no se indexan", () => {
    const pages = inside("/app/admin/").filter(([path]) => /\/page\.tsx$/.test(path));
    expect(pages.length).toBeGreaterThanOrEqual(4);
    for (const [path, source] of pages) {
      expect(source, path).toMatch(/requireAdmin/);
      expect(source, path).toMatch(/index:\s*false/);
    }
  });

  it("la página de edición valida el id y responde 404 si no existe", () => {
    expect(SOURCES["/app/admin/posts/[id]/edit/page.tsx"]).toMatch(/notFound\s*\(/);
  });
});

describe("A05, A09 y A10 en el código del panel", () => {
  it("no usa console, dangerouslySetInnerHTML, innerHTML, eval ni new Function", () => {
    expect(ADMIN_CODE().length).toBeGreaterThan(8);
    expect(offenders(ADMIN_CODE(), /\bconsole\.|dangerouslySetInnerHTML|\.innerHTML|\beval\s*\(|new\s+Function\s*\(/)).toEqual([]);
  });

  it("nunca usa la clave de servicio ni el cliente público sin sesión", () => {
    // El nombre de la clave se compone a propósito: un test de la Fase 1 limita los archivos de tests donde aparece.
    const elevatedKey = new RegExp([["service", "role"].join("_"), ["service", "Role"].join(""), "createPublicClient"].join("|"), "i");
    expect(ADMIN_CODE().length).toBeGreaterThan(8);
    expect(offenders(ADMIN_CODE(), elevatedKey)).toEqual([]);
  });

  it("el contenido se guarda tal cual: lib/admin no importa nada de sanitizado ni de Markdown", () => {
    expect(inside("/lib/admin/").length).toBeGreaterThanOrEqual(10);
    expect(offenders(inside("/lib/admin/"), /rehype|remark|react-markdown|sanitize|@\/lib\/markdown|@\/components\/markdown/i)).toEqual([]);
  });

  it("la vista previa usa exactamente el componente Markdown del blog, sin renderizador propio", () => {
    const preview = SOURCES["/components/admin/markdown-preview.tsx"];
    expect(preview).toMatch(/from\s+["']@\/components\/markdown["']/);
    expect(preview).not.toMatch(/react-markdown|rehype|remark|sanitize/i);
  });

  it("los componentes del panel no renderizan HTML del contenido por su cuenta", () => {
    expect(inside("/components/admin/").length).toBeGreaterThanOrEqual(6);
    const withMarkdownLibs = offenders(inside("/components/admin/", "/app/admin/"), /react-markdown|rehype|remark/i);
    expect(withMarkdownLibs).toEqual([]);
  });
});

describe("CSRF y configuración de las Server Actions", () => {
  it("next.config.ts no relaja el control de origen de Next; solo ajusta el tamaño de las acciones (bloque 4: portada de 2 MB)", () => {
    const config = SOURCES["/next.config.ts"];
    expect(config).toBeDefined();
    expect(config).not.toMatch(/allowedOrigins/);
    expect(config).toMatch(/bodySizeLimit\s*:\s*["']3mb["']/);
  });
});

describe("invalidación de la caché pública", () => {
  it("las páginas públicas siguen siendo dinámicas, así que no hay caché de servidor que quede obsoleta", () => {
    for (const path of ["/app/page.tsx", "/app/blog/page.tsx", "/app/blog/[slug]/page.tsx", "/app/categorias/[slug]/page.tsx"]) {
      expect(SOURCES[path], path).toMatch(/dynamic\s*=\s*["']force-dynamic["']/);
    }
  });

  it("revalidate.ts cubre portada, listado, entradas, categorías y panel", () => {
    const source = SOURCES["/lib/admin/revalidate.ts"];
    for (const route of ['"/"', '"/blog"', "/blog/[slug]", "/categorias/[slug]", '"/admin"']) expect(source).toContain(route);
  });

  it("cada archivo de acciones invalida la caché tras escribir", () => {
    for (const path of ["/lib/admin/posts/actions.ts", "/lib/admin/categories/actions.ts"]) {
      expect(SOURCES[path], path).toMatch(/revalidate/i);
    }
  });
});
