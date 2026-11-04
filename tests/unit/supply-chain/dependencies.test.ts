import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Cadena de suministro (A03): sin red y sin dependencias nuevas, solo leyendo los archivos del repositorio.
const root = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => readFileSync(root(path), "utf8");

type Manifest = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
type LockEntry = { version?: string; resolved?: string; integrity?: string; license?: string; dev?: boolean; optional?: boolean; hasInstallScript?: boolean; link?: boolean };
type Lock = { lockfileVersion: number; packages: Record<string, LockEntry & Manifest> };

const manifest = JSON.parse(read("package.json")) as Manifest;
const lock = JSON.parse(read("package-lock.json")) as Lock;
const entries = Object.entries(lock.packages).filter(([path]) => path !== "");
const nameOf = (path: string) => path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);

/**
 * Dependencias directas ya revisadas (nombre exacto, ámbito y motivo). Una dependencia nueva hace fallar el test hasta que
 * alguien la revise: nombre correcto (la IA puede sugerir uno parecido a un paquete real), mantenimiento y licencia.
 */
const REVIEWED_PRODUCTION: Record<string, string> = {
  "@base-ui/react": "primitivas de UI de los componentes shadcn (MIT)",
  "@supabase/ssr": "cliente de Supabase con cookies en servidor (MIT)",
  "@supabase/supabase-js": "cliente oficial de Supabase (MIT)",
  "class-variance-authority": "variantes de los componentes (Apache-2.0)",
  cn: "mezcla de clases Tailwind; repo shadcn-ui/cn, mantenedor shadcn, sin dependencias ni scripts (MIT). Joven (0.x): vigilar",
  "lucide-react": "iconos (ISC)",
  next: "framework (MIT)",
  react: "biblioteca de UI (MIT)",
  "react-dom": "biblioteca de UI (MIT)",
  "react-markdown": "Markdown sin HTML crudo (ADR 0013) (MIT)",
  "rehype-sanitize": "lista blanca del Markdown (ADR 0013) (MIT)",
  "tw-animate-css": "animaciones CSS (MIT)",
  zod: "validación en servidor (MIT)",
};
const REVIEWED_DEVELOPMENT: Record<string, string> = {
  "@axe-core/playwright": "accesibilidad en los e2e (MPL-2.0)",
  "@playwright/test": "e2e",
  "@tailwindcss/turbopack": "Tailwind con Turbopack",
  "@types/node": "tipos",
  "@types/react": "tipos",
  "@types/react-dom": "tipos",
  "axe-core": "accesibilidad en los e2e (MPL-2.0)",
  eslint: "lint",
  "eslint-config-next": "lint",
  "eslint-plugin-security": "lint de seguridad",
  shadcn: "CLI de shadcn; en ejecución solo se usa su CSS, que se empaqueta al compilar",
  tailwindcss: "estilos (se compilan antes del despliegue)",
  typescript: "compilador",
  vitest: "tests unitarios",
};

const sorted = (record: Record<string, unknown> | undefined) => Object.keys(record ?? {}).sort();

describe("versiones fijadas", () => {
  const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

  it.each([
    ["dependencies", manifest.dependencies],
    ["devDependencies", manifest.devDependencies],
  ])("todas las de %s son versiones exactas (sin ^, ~, *, latest, git, URL ni file:)", (_group, specs) => {
    const loose = Object.entries(specs ?? {}).filter(([, spec]) => !EXACT.test(spec));
    expect(loose).toEqual([]);
  });

  it(".npmrc obliga a guardar versiones exactas", () => {
    expect(read(".npmrc")).toMatch(/^save-exact=true$/m);
  });
});

describe("lockfile", () => {
  it("es de la versión 3 y no está vacío", () => {
    expect(lock.lockfileVersion).toBe(3);
    expect(entries.length).toBeGreaterThan(100);
  });

  it("sus dependencias directas coinciden con package.json", () => {
    const root = lock.packages[""] ?? {};
    expect(root.dependencies).toEqual(manifest.dependencies);
    expect(root.devDependencies).toEqual(manifest.devDependencies);
  });

  it("todo paquete lleva integrity y se resuelve desde el registro de npm", () => {
    const offenders = entries
      .filter(([, entry]) => entry.link || !entry.integrity || !entry.resolved?.startsWith("https://registry.npmjs.org/"))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("la versión del lockfile de cada dependencia directa es la de package.json", () => {
    const direct = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const [name, version] of Object.entries(direct)) expect(lock.packages[`node_modules/${name}`]?.version, name).toBe(version);
  });
});

describe("lista de dependencias revisadas", () => {
  it("las dependencias de producción son exactamente las revisadas (una nueva exige revisarla)", () => {
    expect(sorted(manifest.dependencies)).toEqual(sorted(REVIEWED_PRODUCTION));
  });

  it("las dependencias de desarrollo son exactamente las revisadas (una nueva exige revisarla)", () => {
    expect(sorted(manifest.devDependencies)).toEqual(sorted(REVIEWED_DEVELOPMENT));
  });

  it("ninguna dependencia está en los dos grupos", () => {
    const both = sorted(manifest.dependencies).filter((name) => name in (manifest.devDependencies ?? {}));
    expect(both).toEqual([]);
  });

  it("cada entrada de la lista explica por qué está", () => {
    for (const reason of [...Object.values(REVIEWED_PRODUCTION), ...Object.values(REVIEWED_DEVELOPMENT)]) expect(reason.length).toBeGreaterThan(2);
  });
});

describe("scripts de instalación", () => {
  it("ningún paquete de terceros ejecuta código al instalar, salvo fsevents (opcional, solo macOS)", () => {
    const withScripts = entries.filter(([, entry]) => entry.hasInstallScript).map(([path, entry]) => `${nameOf(path)}${entry.optional ? " (opcional)" : ""}`);
    expect(withScripts).toEqual(["fsevents (opcional)"]);
  });
});

describe("licencias", () => {
  it("todo paquete declara licencia", () => {
    expect(entries.filter(([, entry]) => !entry.license).map(([path]) => path)).toEqual([]);
  });

  it("ninguna GPL ni AGPL en ningún árbol", () => {
    const strong = entries.filter(([, entry]) => /(^|[^L])GPL|AGPL/.test(entry.license ?? "")).map(([path, entry]) => `${nameOf(path)}: ${entry.license}`);
    expect(strong).toEqual([]);
  });

  it("la LGPL solo aparece en los binarios opcionales de sharp (libvips, de next/image)", () => {
    const offenders = entries
      .filter(([, entry]) => /LGPL/.test(entry.license ?? ""))
      .filter(([path, entry]) => !(nameOf(path).startsWith("@img/sharp-") && entry.optional === true))
      .map(([path, entry]) => `${nameOf(path)}: ${entry.license}`);
    expect(offenders).toEqual([]);
  });

  it("MPL-2.0, Python-2.0 y CC0 solo en el árbol de desarrollo", () => {
    const offenders = entries
      .filter(([, entry]) => /MPL-2\.0|Python-2\.0|CC0-1\.0/.test(entry.license ?? "") && !/MIT OR CC0/.test(entry.license ?? ""))
      .filter(([, entry]) => entry.dev !== true)
      .map(([path, entry]) => `${nameOf(path)}: ${entry.license}`);
    expect(offenders).toEqual([]);
  });
});

describe("Dependabot", () => {
  const config = existsSync(root(".github/dependabot.yml")) ? read(".github/dependabot.yml") : "";

  it("existe .github/dependabot.yml", () => {
    expect(config).not.toBe("");
  });

  it.each(["npm", "github-actions"])("vigila el ecosistema %s", (ecosystem) => {
    expect(config).toMatch(new RegExp(`package-ecosystem:\\s*["']?${ecosystem}["']?`));
  });

  it("revisa cada semana, agrupa las actualizaciones y limita las PR abiertas", () => {
    expect(config.match(/interval:\s*["']?weekly["']?/g)).toHaveLength(2);
    expect(config).toMatch(/groups:/);
    expect(config.match(/open-pull-requests-limit:\s*1\b/g)).toHaveLength(2);
  });
});

describe("CI", () => {
  const ci = read(".github/workflows/ci.yml");

  it("instala con npm ci (lockfile exacto), nunca con npm install", () => {
    expect(ci).toMatch(/run:\s*npm ci\b/);
    expect(ci).not.toMatch(/npm (install|i)\b/);
  });

  it("audita todo con nivel alto y la producción sin excepciones", () => {
    expect(ci).toMatch(/npm audit --audit-level=high/);
    expect(ci).toMatch(/npm audit --omit=dev\s*$/m);
  });
});
