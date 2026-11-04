import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// El script de ZAP debe decir siempre por qué se detiene (nunca salir en silencio) y leer los formatos habituales de .env.
// Se ejecuta de verdad, pero solo hasta su guarda: con valores falsos y sin arrancar nada. Nunca se toca el archivo real.
const SCRIPT = new URL("../../../scripts/zap-baseline.sh", import.meta.url).pathname;
const FAKE_KEY = "clave-publica-falsa-0123456789";
const FAKE_REF = "abcdefgh";
const FAKE_URL = `https://${FAKE_REF}.supabase.co`;
const sandboxes: string[] = [];

function run(envFile: string | null, extraEnv: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "zap-env-"));
  sandboxes.push(dir);
  mkdirSync(join(dir, "scripts"));
  copyFileSync(SCRIPT, join(dir, "scripts", "zap-baseline.sh"));
  if (envFile !== null) writeFileSync(join(dir, ".env.test.local"), envFile);
  const result = spawnSync("bash", ["scripts/zap-baseline.sh"], { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH ?? "", ...extraEnv } as unknown as NodeJS.ProcessEnv, timeout: 20_000 });
  return { status: result.status, out: `${result.stdout}${result.stderr}`, stderr: result.stderr, stdout: result.stdout };
}

afterAll(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});

const valid = (url = FAKE_URL) => `SUPABASE_TEST_PROJECT_REF=${FAKE_REF}\nSUPABASE_TEST_URL=${url}\nSUPABASE_TEST_ANON_KEY=${FAKE_KEY}\n`;

describe("el script nunca falla en silencio", () => {
  it("sin archivo de entorno: explica qué falta y sale con error", () => {
    const result = run(null);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Falta el archivo/);
  });

  it.each([
    ["un archivo vacío", ""],
    ["solo comentarios", "# nada que ver\n"],
    ["sin la clave pública", `SUPABASE_TEST_PROJECT_REF=${FAKE_REF}\nSUPABASE_TEST_URL=${FAKE_URL}\n`],
    ["sin la referencia", `SUPABASE_TEST_URL=${FAKE_URL}\nSUPABASE_TEST_ANON_KEY=${FAKE_KEY}\n`],
  ])("%s: dice cuál falta (por su nombre) y sale con error", (_caso, content) => {
    const result = run(content);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Falta la variable SUPABASE_TEST_/);
    expect(result.out).not.toContain(FAKE_KEY);
  });

  it("nombra todas las variables que faltan, no solo la primera", () => {
    const result = run("");
    for (const name of ["SUPABASE_TEST_PROJECT_REF", "SUPABASE_TEST_URL", "SUPABASE_TEST_ANON_KEY"]) expect(result.stderr).toContain(name);
  });
});

describe("la guarda del proyecto de test", () => {
  it.each([
    ["una URL que no es la de la referencia", valid("https://otro-proyecto.supabase.co")],
    ["una URL con un sufijo malicioso", valid(`${FAKE_URL}.evil.example`)],
    ["una URL sin https", valid(`http://${FAKE_REF}.supabase.co`)],
  ])("%s: aborta con su mensaje y sin imprimir valores", (_caso, content) => {
    const result = run(content);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/no es el del proyecto de test/);
    expect(result.out).not.toContain(FAKE_KEY);
    expect(result.out).not.toContain(FAKE_REF);
  });
});

describe("formatos habituales de un archivo .env", () => {
  const FORMATS: [string, string][] = [
    ["sin comillas", valid()],
    ["con comillas dobles", `SUPABASE_TEST_PROJECT_REF="${FAKE_REF}"\nSUPABASE_TEST_URL="${FAKE_URL}"\nSUPABASE_TEST_ANON_KEY="${FAKE_KEY}"\n`],
    ["con comillas simples", `SUPABASE_TEST_PROJECT_REF='${FAKE_REF}'\nSUPABASE_TEST_URL='${FAKE_URL}'\nSUPABASE_TEST_ANON_KEY='${FAKE_KEY}'\n`],
    ["con «export» delante", `export SUPABASE_TEST_PROJECT_REF=${FAKE_REF}\nexport SUPABASE_TEST_URL=${FAKE_URL}\nexport SUPABASE_TEST_ANON_KEY=${FAKE_KEY}\n`],
    ["con espacios alrededor del igual", `SUPABASE_TEST_PROJECT_REF = ${FAKE_REF}\nSUPABASE_TEST_URL = ${FAKE_URL}\nSUPABASE_TEST_ANON_KEY = ${FAKE_KEY}\n`],
    ["con saltos de línea de Windows", valid().replaceAll("\n", "\r\n")],
    ["con comentarios y líneas en blanco", `# proyecto de test\n\n${valid()}\n# fin\n`],
    ["con un comentario al final de la línea", `SUPABASE_TEST_PROJECT_REF=${FAKE_REF} # ref\nSUPABASE_TEST_URL=${FAKE_URL} # url\nSUPABASE_TEST_ANON_KEY=${FAKE_KEY} # clave\n`],
  ];

  it.each(FORMATS)("%s: se lee bien y supera la guarda", (_caso, content) => {
    const result = run(content, { ZAP_CHECK_ONLY: "1" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Entorno de test verificado/);
  });

  it("la comprobación sin escaneo no imprime ningún valor ni arranca nada", () => {
    const result = run(valid(), { ZAP_CHECK_ONLY: "1" });
    expect(result.out).not.toContain(FAKE_KEY);
    expect(result.out).not.toContain(FAKE_URL);
    expect(result.out).not.toContain(FAKE_REF);
    expect(result.out).not.toMatch(/Compilando|Arrancando|docker/i);
  });

  it("sin ZAP_CHECK_ONLY la guarda superada continúa hacia el build (no se prueba aquí)", () => {
    // Con valores válidos el script seguiría con `npm run build`: no se ejecuta en un test. Se comprueba solo que existe la salida temprana.
    expect(spawnSync("grep", ["-c", "ZAP_CHECK_ONLY", SCRIPT], { encoding: "utf8" }).stdout.trim()).not.toBe("0");
  });
});
