import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Escaneo ZAP baseline (Fase 3, E): pasivo, en local y contra el proyecto de Supabase de TEST, nunca producción.
const root = (path: string) => new URL(`../../../${path}`, import.meta.url);
const SCRIPT = "scripts/zap-baseline.sh";
const script = existsSync(root(SCRIPT)) ? readFileSync(root(SCRIPT), "utf8") : "";
const code = script
  .split("\n")
  .filter((line) => !/^\s*#/.test(line))
  .join("\n");

describe("scripts/zap-baseline.sh", () => {
  it("existe y es ejecutable", () => {
    expect(script).not.toBe("");
    expect(statSync(root(SCRIPT)).mode & 0o111).not.toBe(0);
  });

  it("tiene una sintaxis de bash válida", () => {
    const result = spawnSync("bash", ["-n", new URL(root(SCRIPT)).pathname], { encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
  });

  it("falla ante cualquier error y no usa variables sin definir", () => {
    expect(code).toMatch(/^set -euo pipefail$/m);
  });
});

describe("modo baseline: solo escaneo pasivo", () => {
  it("usa zap-baseline.py de la imagen oficial", () => {
    expect(code).toContain("zap-baseline.py");
    expect(code).toContain("ghcr.io/zaproxy/zaproxy");
  });

  it.each(["zap-full-scan", "zap-api-scan", "ascan", "activeScan", "attack"])("no usa %s (nada de ataques activos)", (forbidden) => {
    expect(code).not.toContain(forbidden);
  });

  it("limita el rastreo en el tiempo", () => {
    expect(code).toMatch(/zap-baseline\.py[^\n]*\s-m\s+\d+/);
  });

  it("escanea el build de producción, no next dev", () => {
    expect(code).toMatch(/npm run build/);
    expect(code).toMatch(/npm (run )?start/);
    expect(code).not.toMatch(/next dev|npm run dev/);
  });
});

describe("solo en local y solo con el proyecto de test", () => {
  it("todas las URL http apuntan a localhost o a host.docker.internal", () => {
    const urls = [...code.matchAll(/https?:\/\/[^\s"'\\]+/g)].map((match) => match[0]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls.filter((item) => !/supabase\.co/.test(item))) expect(url).toMatch(/^http:\/\/(localhost|host\.docker\.internal)(:|\/|\$|\{|"|'|$)/);
  });

  it("aborta si la URL de Supabase no es exactamente la del proyecto de test", () => {
    expect(code).toContain("SUPABASE_TEST_URL");
    expect(code).toContain("SUPABASE_TEST_PROJECT_REF");
    expect(code).toMatch(/https:\/\/\$\{?SUPABASE_TEST_PROJECT_REF\}?\.supabase\.co/);
    expect(code).toMatch(/exit 1/);
  });

  it("solo carga .env.test.local (nunca .env.local ni .env.production) y solo exporta las dos variables públicas", () => {
    expect(code).toContain(".env.test.local");
    expect(code).not.toMatch(/\.env(?!\.test\.local)/);
    expect(code).toMatch(/export NEXT_PUBLIC_SUPABASE_URL=/);
    expect(code).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY=/);
  });

  it("nunca usa la clave de rol de servicio", () => {
    expect(script).not.toMatch(/service.?role/i);
  });

  it("no imprime variables ni secretos", () => {
    expect(code).not.toMatch(/set -[a-z]*x/);
    expect(code).not.toMatch(/\b(printenv|env)\s*(\||$)/m);
    expect(code).not.toMatch(/\b(echo|printf)\b[^\n]*(KEY|SECRET|TOKEN|PASSWORD|SUPABASE_TEST_URL|ANON)/);
    expect(code).not.toMatch(/\bcat\b[^\n]*\.env/);
  });
});

describe("informes y limpieza", () => {
  it("escribe los informes en zap-reports/ y solo monta esa carpeta en el contenedor", () => {
    expect(code).toContain("zap-reports");
    expect(code).toMatch(/-v\s+"?\$\{?(PWD|REPORTS)[^\n]*zap-reports[^\n]*:\/zap\/wrk/);
    expect(code).not.toMatch(/-v\s+"?\$(PWD|HOME)"?:/);
    expect(code).toMatch(/-r\s+\S*zap-baseline\.html/);
    expect(code).toMatch(/-J\s+\S*zap-baseline\.json/);
  });

  it("zap-reports/ está en .gitignore", () => {
    expect(readFileSync(root(".gitignore"), "utf8")).toMatch(/^zap-reports\/?$/m);
  });

  it("apaga el servidor al terminar, también si algo falla (trap)", () => {
    expect(code).toMatch(/trap\s+\S+[^\n]*EXIT/);
    expect(code).toMatch(/kill\b/);
  });

  it("el contenedor se borra al terminar (--rm)", () => {
    expect(code).toMatch(/docker run[^\n]*--rm|--rm[^\n]*docker run|docker run\s*\\?\n[^\n]*--rm/);
  });

  it("funciona en Linux (--network host) y en macOS y Windows (host.docker.internal)", () => {
    expect(code).toContain("--network host");
    expect(code).toContain("host.docker.internal");
  });
});

describe("package.json", () => {
  const manifest = JSON.parse(readFileSync(root("package.json"), "utf8")) as { scripts?: Record<string, string> };

  it("tiene el script zap que lanza el escaneo", () => {
    expect(manifest.scripts?.zap).toBe("bash scripts/zap-baseline.sh");
  });
});
