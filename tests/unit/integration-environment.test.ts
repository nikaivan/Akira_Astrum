import { describe, expect, it } from "vitest";
import { assertTestEnvironment } from "@/tests/integration/support/environment";

const REF = "abcdefghijklmnopqrst";
const URL = `https://${REF}.supabase.co`;

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (claims: object) => `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(claims)}.firma`;

const ANON = jwt({ ref: REF, role: "anon" });
const SERVICE = jwt({ ref: REF, role: "service_role" });

function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    SUPABASE_TEST_PROJECT_REF: REF,
    SUPABASE_TEST_URL: URL,
    SUPABASE_TEST_ANON_KEY: ANON,
    SUPABASE_TEST_SERVICE_ROLE_KEY: SERVICE,
    ...overrides,
  };
}

describe("assertTestEnvironment", () => {
  it("acepta un entorno de test coherente", () => {
    expect(assertTestEnvironment(validEnv())).toEqual({
      projectRef: REF,
      url: URL,
      anonKey: ANON,
      serviceRoleKey: SERVICE,
    });
  });

  it("acepta la URL con barra final", () => {
    expect(assertTestEnvironment(validEnv({ SUPABASE_TEST_URL: `${URL}/` })).url).toBe(URL);
  });

  it("acepta las claves del formato nuevo", () => {
    const env = validEnv({
      SUPABASE_TEST_ANON_KEY: "sb_publishable_abc",
      SUPABASE_TEST_SERVICE_ROLE_KEY: "sb_secret_abc",
    });
    expect(assertTestEnvironment(env).anonKey).toBe("sb_publishable_abc");
  });

  it.each([
    "SUPABASE_TEST_PROJECT_REF",
    "SUPABASE_TEST_URL",
    "SUPABASE_TEST_ANON_KEY",
    "SUPABASE_TEST_SERVICE_ROLE_KEY",
  ])("aborta si falta %s, indicando solo su nombre", (name) => {
    expect(() => assertTestEnvironment(validEnv({ [name]: undefined }))).toThrow(name);
  });

  it("aborta si una variable está en blanco", () => {
    expect(() => assertTestEnvironment(validEnv({ SUPABASE_TEST_URL: "   " }))).toThrow("SUPABASE_TEST_URL");
  });

  it.each([
    ["otro proyecto", "https://zzzzzzzzzzzzzzzzzzzz.supabase.co"],
    ["http en vez de https", `http://${REF}.supabase.co`],
    ["una ruta", `${URL}/rest/v1`],
    ["usuario y contraseña", `https://usuario:clave@${REF}.supabase.co`],
    ["otro puerto", `https://${REF}.supabase.co:8443`],
    ["un dominio que lo contiene", `https://${REF}.supabase.co.malicioso.com`],
    ["un prefijo añadido al ref", `https://x${REF}.supabase.co`],
    ["otro dominio", `https://${REF}.ejemplo.com`],
    ["localhost", "http://127.0.0.1:54321"],
    ["texto que no es una URL", "esto-no-es-una-url"],
  ])("aborta si la URL no coincide con SUPABASE_TEST_PROJECT_REF: %s", (_caso, url) => {
    expect(() => assertTestEnvironment(validEnv({ SUPABASE_TEST_URL: url }))).toThrow("SUPABASE_TEST_URL");
  });

  it.each(["ABC", "ref con espacios", "ref.con.puntos", "../ref"])(
    "aborta si el ref no tiene un formato válido: %j",
    (ref) => {
      expect(() => assertTestEnvironment(validEnv({ SUPABASE_TEST_PROJECT_REF: ref }))).toThrow(
        "SUPABASE_TEST_PROJECT_REF",
      );
    },
  );

  it.each([
    ["SUPABASE_TEST_ANON_KEY", jwt({ ref: "otroproyecto", role: "anon" })],
    ["SUPABASE_TEST_ANON_KEY", jwt({ role: "anon" })],
    ["SUPABASE_TEST_SERVICE_ROLE_KEY", jwt({ ref: "otroproyecto", role: "service_role" })],
    ["SUPABASE_TEST_SERVICE_ROLE_KEY", jwt({ role: "service_role" })],
  ])("aborta si una clave de %s no pertenece al proyecto de test", (name, key) => {
    expect(() => assertTestEnvironment(validEnv({ [name]: key }))).toThrow(name);
  });

  it("aborta si las claves están intercambiadas", () => {
    const swapped = validEnv({ SUPABASE_TEST_ANON_KEY: SERVICE, SUPABASE_TEST_SERVICE_ROLE_KEY: ANON });
    expect(() => assertTestEnvironment(swapped)).toThrow("SUPABASE_TEST_ANON_KEY");
  });

  it("aborta si la clave anónima es una clave secreta del formato nuevo", () => {
    const env = validEnv({ SUPABASE_TEST_ANON_KEY: "sb_secret_abc" });
    expect(() => assertTestEnvironment(env)).toThrow("SUPABASE_TEST_ANON_KEY");
  });

  it("aborta si el proyecto de test es el de producción", () => {
    const env = validEnv({ NEXT_PUBLIC_SUPABASE_URL: URL });
    expect(() => assertTestEnvironment(env)).toThrow("producción");
  });

  it.each([
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE],
  ])("aborta si una clave de test es la de producción (%s)", (name, key) => {
    expect(() => assertTestEnvironment(validEnv({ [name]: key }))).toThrow("producción");
  });

  it("no rechaza un proyecto de producción distinto", () => {
    const env = validEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" });
    expect(() => assertTestEnvironment(env)).not.toThrow();
  });

  it("los mensajes de error nunca contienen una URL, un ref ni una clave", () => {
    const secretos = [REF, URL, ANON, SERVICE, "sb_secret_abc"];
    const entornos = [
      validEnv({ SUPABASE_TEST_URL: `https://usuario:clave@${REF}.supabase.co` }),
      validEnv({ SUPABASE_TEST_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" }),
      validEnv({ SUPABASE_TEST_ANON_KEY: SERVICE, SUPABASE_TEST_SERVICE_ROLE_KEY: ANON }),
      validEnv({ SUPABASE_TEST_ANON_KEY: jwt({ ref: "otroproyecto", role: "anon" }) }),
      validEnv({ NEXT_PUBLIC_SUPABASE_URL: URL }),
      validEnv({ SUPABASE_SERVICE_ROLE_KEY: SERVICE }),
      validEnv({ SUPABASE_TEST_ANON_KEY: "sb_secret_abc" }),
    ];
    for (const env of entornos) {
      let message = "";
      try {
        assertTestEnvironment(env);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).not.toBe("");
      for (const secreto of secretos) expect(message).not.toContain(secreto);
    }
  });

  it("no modifica el entorno recibido", () => {
    const env = Object.freeze(validEnv());
    expect(() => assertTestEnvironment(env)).not.toThrow();
  });
});
