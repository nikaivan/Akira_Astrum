export type TestEnvironment = {
  projectRef: string;
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

type Env = Readonly<Record<string, string | undefined>>;
type KeyRole = "anon" | "service_role";

// Los mensajes nombran la variable o la regla, nunca su valor.
function fail(reason: string): never {
  throw new Error(`Entorno de integración rechazado: ${reason}.`);
}

/** Lee el payload de un JWT sin verificarlo; null si la clave no es un JWT. */
function jwtPayload(key: string): { ref?: unknown; role?: unknown } | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

function checkKey(name: string, key: string, role: KeyRole, projectRef: string): void {
  const payload = jwtPayload(key);
  if (payload) {
    if (payload.ref !== projectRef) fail(`${name} no pertenece al proyecto de test`);
    if (payload.role !== role) fail(`${name} no es una clave de tipo ${role}`);
    return;
  }
  const otherKind = role === "anon" ? "sb_secret_" : "sb_publishable_";
  if (key.startsWith(otherKind)) fail(`${name} es una clave de otro tipo`);
}

function sameHost(candidate: string, url: URL): boolean {
  try {
    return new URL(candidate).host === url.host;
  } catch {
    return false;
  }
}

/**
 * Comprueba que las variables de test apuntan al proyecto de test indicado en
 * SUPABASE_TEST_PROJECT_REF y no al de producción. Aborta antes de cualquier petición.
 */
export function assertTestEnvironment(env: Env): TestEnvironment {
  const required = {
    SUPABASE_TEST_PROJECT_REF: env.SUPABASE_TEST_PROJECT_REF?.trim() ?? "",
    SUPABASE_TEST_URL: env.SUPABASE_TEST_URL?.trim() ?? "",
    SUPABASE_TEST_ANON_KEY: env.SUPABASE_TEST_ANON_KEY?.trim() ?? "",
    SUPABASE_TEST_SERVICE_ROLE_KEY: env.SUPABASE_TEST_SERVICE_ROLE_KEY?.trim() ?? "",
  };

  const missing = Object.entries(required)
    .filter(([, value]) => value === "")
    .map(([name]) => name);
  if (missing.length > 0) fail(`faltan variables: ${missing.join(", ")}`);

  const {
    SUPABASE_TEST_PROJECT_REF: projectRef,
    SUPABASE_TEST_URL: rawUrl,
    SUPABASE_TEST_ANON_KEY: anonKey,
    SUPABASE_TEST_SERVICE_ROLE_KEY: serviceRoleKey,
  } = required;
  if (!/^[a-z0-9]+$/.test(projectRef)) fail("SUPABASE_TEST_PROJECT_REF no tiene un formato válido");

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return fail("SUPABASE_TEST_URL no es una URL válida");
  }
  const exact =
    url.origin === `https://${projectRef}.supabase.co` &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "" &&
    url.username === "" &&
    url.password === "";
  if (!exact) fail("SUPABASE_TEST_URL no coincide con SUPABASE_TEST_PROJECT_REF");

  checkKey("SUPABASE_TEST_ANON_KEY", anonKey, "anon", projectRef);
  checkKey("SUPABASE_TEST_SERVICE_ROLE_KEY", serviceRoleKey, "service_role", projectRef);

  const productionUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (productionUrl && sameHost(productionUrl, url)) fail("el proyecto de test es el de producción");
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY === anonKey || env.SUPABASE_SERVICE_ROLE_KEY === serviceRoleKey) {
    fail("las claves de test son las de producción");
  }

  return { projectRef, url: url.origin, anonKey, serviceRoleKey };
}
