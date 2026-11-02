import { describe, expect, it } from "vitest";
import { E2E_BASE_URL, E2E_PORT, loadTestEnvironment, serverEnvFor } from "@/tests/e2e/support/environment";

const REF = "abcdefghijklmnopqrst";
const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (claims: object) => `${base64url({ alg: "HS256" })}.${base64url(claims)}.firma`;

const VALID = {
  SUPABASE_TEST_PROJECT_REF: REF,
  SUPABASE_TEST_URL: `https://${REF}.supabase.co`,
  SUPABASE_TEST_ANON_KEY: jwt({ ref: REF, role: "anon" }),
  SUPABASE_TEST_SERVICE_ROLE_KEY: jwt({ ref: REF, role: "service_role" }),
};

describe("entorno de los e2e", () => {
  it("el servidor de los e2e usa un puerto propio, distinto del de desarrollo", () => {
    expect(E2E_PORT).toBe(3100);
    expect(E2E_BASE_URL).toBe("http://localhost:3100");
  });

  it("serverEnvFor apunta la aplicación al proyecto de test y a nada más", () => {
    const env = loadTestEnvironment(VALID, () => {});
    expect(serverEnvFor(env)).toStrictEqual({
      NEXT_PUBLIC_SUPABASE_URL: VALID.SUPABASE_TEST_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID.SUPABASE_TEST_ANON_KEY,
    });
  });

  it("serverEnvFor no entrega la clave service_role a la aplicación", () => {
    const serialized = JSON.stringify(serverEnvFor(loadTestEnvironment(VALID, () => {})));
    expect(serialized).not.toContain(VALID.SUPABASE_TEST_SERVICE_ROLE_KEY);
  });

  it("carga el archivo de claves antes de comprobar el entorno", () => {
    const order: string[] = [];
    loadTestEnvironment(VALID, () => order.push("archivo"));
    expect(order).toEqual(["archivo"]);
  });

  it.each(Object.keys(VALID))("aborta si falta %s", (name) => {
    const env = { ...VALID, [name]: undefined };
    expect(() => loadTestEnvironment(env, () => {})).toThrow(name);
  });

  it("aborta si la URL no coincide con SUPABASE_TEST_PROJECT_REF", () => {
    const env = { ...VALID, SUPABASE_TEST_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" };
    expect(() => loadTestEnvironment(env, () => {})).toThrow("SUPABASE_TEST_URL");
  });

  it("aborta si el proyecto de test es el de producción", () => {
    const env = { ...VALID, NEXT_PUBLIC_SUPABASE_URL: VALID.SUPABASE_TEST_URL };
    expect(() => loadTestEnvironment(env, () => {})).toThrow("producción");
  });
});
