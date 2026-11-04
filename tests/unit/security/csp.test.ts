import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "@/lib/security/csp";

const NONCE = "dGVzdC1ub25jZS0xMjM0NTY3OA==";
const STORAGE = "https://abcdefgh.supabase.co";

const csp = (overrides: Partial<Parameters<typeof buildCsp>[0]> = {}) =>
  buildCsp({ nonce: NONCE, isDev: false, storageOrigin: STORAGE, ...overrides });

/** Valor de cada directiva, en una tabla nombre → fuentes. */
const directives = (policy: string) =>
  Object.fromEntries(
    policy
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.split(/\s+/);
        return [name, sources];
      }),
  ) as Record<string, string[]>;

describe("buildCsp: scripts", () => {
  it("en producción script-src no admite unsafe-inline ni unsafe-eval", () => {
    const script = directives(csp())["script-src"];
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it("script-src se apoya en el nonce de la petición y en strict-dynamic", () => {
    const script = directives(csp())["script-src"];
    expect(script).toContain("'self'");
    expect(script).toContain(`'nonce-${NONCE}'`);
    expect(script).toContain("'strict-dynamic'");
  });

  it("en desarrollo solo se añade unsafe-eval a los scripts (React lo necesita para depurar)", () => {
    const script = directives(csp({ isDev: true }))["script-src"];
    expect(script).toContain("'unsafe-eval'");
    expect(script).not.toContain("'unsafe-inline'");
  });

  it("ninguna directiva permite comodines ni esquemas abiertos", () => {
    const sources = Object.values(directives(csp())).flat();
    for (const forbidden of ["*", "https:", "http:", "data:"]) expect(sources).not.toContain(forbidden);
  });
});

describe("buildCsp: estilos", () => {
  it("en producción style-src usa el nonce y no admite unsafe-inline", () => {
    const style = directives(csp())["style-src"];
    expect(style).toContain("'self'");
    expect(style).toContain(`'nonce-${NONCE}'`);
    expect(style).not.toContain("'unsafe-inline'");
  });

  it("en desarrollo style-src admite unsafe-inline (el HMR inyecta estilos)", () => {
    expect(directives(csp({ isDev: true }))["style-src"]).toContain("'unsafe-inline'");
  });
});

describe("buildCsp: directivas obligatorias", () => {
  it.each([
    ["default-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'"]],
    ["worker-src", ["'self'"]],
    ["manifest-src", ["'self'"]],
  ])("%s = %j", (name, expected) => {
    expect(directives(csp())[name]).toEqual(expected);
  });

  it("upgrade-insecure-requests solo en producción (en local se sirve por http)", () => {
    expect(Object.keys(directives(csp()))).toContain("upgrade-insecure-requests");
    expect(Object.keys(directives(csp({ isDev: true })))).not.toContain("upgrade-insecure-requests");
  });

  it("es una sola línea, sin saltos de línea", () => {
    expect(csp()).not.toMatch(/[\r\n]/);
  });
});

describe("buildCsp: img-src", () => {
  it("permite el propio origen, blob: (vista previa del editor) y el Storage del proyecto", () => {
    expect(directives(csp())["img-src"]).toEqual(["'self'", "blob:", STORAGE]);
  });

  it.each([undefined, null, "", "no es una url", "http://abcdefgh.supabase.co", "https://user:pass@abcdefgh.supabase.co", "https://abcdefgh.supabase.co:8443", "javascript:alert(1)"])(
    "sin un origen de Storage válido (%j) img-src solo admite 'self' y blob:",
    (storageOrigin) => {
      expect(directives(csp({ storageOrigin }))["img-src"]).toEqual(["'self'", "blob:"]);
    },
  );

  it("un origen con intento de inyectar directivas no altera la política", () => {
    const hostile = "https://abcdefgh.supabase.co; script-src 'unsafe-inline'";
    const policy = csp({ storageOrigin: hostile });
    expect(directives(policy)["img-src"]).toEqual(["'self'", "blob:"]);
    expect(directives(policy)["script-src"]).not.toContain("'unsafe-inline'");
    expect(policy.match(/script-src/g)).toHaveLength(1);
  });

  it("acepta la URL completa del proyecto y se queda solo con el origen", () => {
    expect(directives(csp({ storageOrigin: "https://abcdefgh.supabase.co/rest/v1/?x=1" }))["img-src"]).toEqual(["'self'", "blob:", STORAGE]);
  });
});

describe("buildCsp: el nonce", () => {
  it.each(["", "a b", "x';y", "a\nb", "<script>", "bad nonce"])("un nonce inválido (%j) lanza un error en vez de generar una política débil", (nonce) => {
    expect(() => buildCsp({ nonce, isDev: false, storageOrigin: STORAGE })).toThrow();
  });
});

describe("generateNonce", () => {
  it("genera valores distintos en cada llamada", () => {
    const nonces = new Set(Array.from({ length: 200 }, generateNonce));
    expect(nonces.size).toBe(200);
  });

  it("tiene al menos 128 bits y solo caracteres base64", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(Buffer.from(nonce, "base64").length).toBeGreaterThanOrEqual(16);
  });

  it("es válido para buildCsp", () => {
    expect(() => buildCsp({ nonce: generateNonce(), isDev: false, storageOrigin: STORAGE })).not.toThrow();
  });
});
