import { existsSync } from "node:fs";
import { assertTestEnvironment, type TestEnvironment } from "../../integration/support/environment";

/** Puerto propio de los e2e: nunca se reutiliza el servidor de desarrollo (que usa .env.local). */
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

function loadDefaultFile(): void {
  if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
}

/** Carga .env.test.local (si existe) y aborta si el entorno no es el del proyecto de test. */
export function loadTestEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
  loadFile: () => void = loadDefaultFile,
): TestEnvironment {
  loadFile();
  return assertTestEnvironment(env);
}

/** Variables con las que se arranca el servidor de la aplicación: solo las dos públicas, del proyecto de test. */
export function serverEnvFor(env: TestEnvironment): Record<string, string> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: env.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.anonKey,
  };
}
