/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const APP = import.meta.glob(["/app/**/*.{ts,tsx}", "/lib/**/*.{ts,tsx}", "/proxy.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const TESTS = import.meta.glob("/tests/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const files = (pattern: RegExp) => Object.entries(APP).filter(([path]) => pattern.test(path));
const matching = (sources: Record<string, string>, pattern: RegExp) =>
  Object.entries(sources)
    .filter(([, source]) => pattern.test(source))
    .map(([path]) => path)
    .sort();

describe("el análisis cubre los archivos esperados", () => {
  it("encuentra el código de la autenticación", () => {
    const paths = Object.keys(APP);
    for (const expected of [
      "/proxy.ts",
      "/lib/auth/authorize.ts",
      "/lib/auth/require-admin.ts",
      "/lib/auth/login.ts",
      "/lib/auth/actions.ts",
      "/app/login/page.tsx",
      "/app/admin/layout.tsx",
      "/app/admin/page.tsx",
    ]) {
      expect(paths).toContain(expected);
    }
  });
});

describe("la autorización", () => {
  it("nunca usa getSession() en la aplicación", () => {
    expect(matching(APP, /\.getSession\s*\(/)).toEqual([]);
  });

  it("se apoya en getUser(), que valida el token con el servidor de Auth", () => {
    expect(APP["/lib/auth/authorize.ts"]).toMatch(/\.getUser\s*\(/);
  });

  it("la capa de acceso a datos reutiliza authorizeAdmin", () => {
    expect(APP["/lib/auth/require-admin.ts"]).toMatch(/authorizeAdmin/);
    expect(APP["/proxy.ts"]).toMatch(/authorizeAdmin|adminResponse/);
  });

  it("el layout y la página del panel comprueban el rol por sí mismos", () => {
    expect(APP["/app/admin/layout.tsx"]).toMatch(/requireAdmin/);
    expect(APP["/app/admin/page.tsx"]).toMatch(/requireAdmin/);
  });
});

describe("Server Actions y Route Handlers", () => {
  const DIRECTIVE = /^\s*["']use server["']/m;
  const PUBLIC_ACTIONS = ["/lib/auth/actions.ts"];

  it("los únicos archivos 'use server' son los de login/logout y los que comprueban al admin", () => {
    expect(matching(APP, DIRECTIVE)).toContain("/lib/auth/actions.ts");
    const unprotected = Object.entries(APP)
      .filter(([path, source]) => DIRECTIVE.test(source) && !PUBLIC_ACTIONS.includes(path))
      .filter(([, source]) => !/requireAdmin|withAdminAction/.test(source))
      .map(([path]) => path);
    expect(unprotected).toEqual([]);
  });

  it("todo archivo con 'use server' o route.ts bajo /app/admin comprueba al admin", () => {
    const unprotected = files(/^\/app\/admin\//)
      .filter(([path, source]) => /\/route\.ts$/.test(path) || DIRECTIVE.test(source))
      .filter(([, source]) => !/requireAdmin|withAdminAction|withAdminRoute/.test(source))
      .map(([path]) => path);
    expect(unprotected).toEqual([]);
  });
});

describe("sin registro de usuarios", () => {
  it("el código no puede crear cuentas ni restablecer contraseñas", () => {
    expect(matching(APP, /signUp\s*\(|signInWithOAuth|signInWithOtp|signInWithSSO|resetPasswordForEmail/)).toEqual([]);
  });

  it("no existe ninguna ruta de registro", () => {
    const registration = Object.keys(APP).filter((path) => /\/(register|signup|sign-up|registro|registrarse)(\/|\.|$)/i.test(path));
    expect(registration).toEqual([]);
  });
});

describe("sin secretos", () => {
  it("la aplicación no usa console en el código de autenticación", () => {
    const auth = Object.fromEntries(files(/^\/(lib\/auth\/|proxy\.ts)/));
    expect(Object.keys(auth).length).toBeGreaterThan(3);
    expect(matching(auth, /\bconsole\./)).toEqual([]);
  });

  it("la clave service_role no aparece en app/, lib/ ni proxy.ts", () => {
    expect(Object.keys(APP).length).toBeGreaterThan(10);
    expect(matching(APP, /SERVICE_ROLE|service_role|serviceRole/i)).toEqual([]);
  });

  // Vite excluye del glob al propio archivo, así que este test no aparece en la lista.
  it("en los tests, service_role solo aparece en los archivos documentados", () => {
    expect(matching(TESTS, /SERVICE_ROLE|service_role|serviceRole/i)).toEqual([
      "/tests/e2e/support/service-role.ts",
      "/tests/integration/support/environment.ts",
      "/tests/integration/support/service-role.ts",
      "/tests/unit/e2e-environment.test.ts",
      "/tests/unit/integration-environment.test.ts",
    ]);
  });
});
