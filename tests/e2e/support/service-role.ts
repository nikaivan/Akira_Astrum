/**
 * ÚNICO archivo de los e2e que usa SUPABASE_TEST_SERVICE_ROLE_KEY.
 * Uso permitido, solo contra el proyecto de test (ver tests/integration/README.md):
 * crear y borrar los usuarios temporales de los e2e y su perfil.
 * Nunca se usan las credenciales reales del admin. Nunca en app/, lib/ ni proxy.ts.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { assertTestEnvironment } from "../../integration/support/environment";

export type E2EUser = { id: string; email: string; password: string };

const OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } } as const;

function serviceClient() {
  const { url, serviceRoleKey } = assertTestEnvironment(process.env);
  return createClient(url, serviceRoleKey, OPTIONS);
}

/** runId empieza por "itest-": la limpieza de la suite de integración borra los restos. */
export async function createE2EUser(runId: string, label: string, role: "admin" | "user"): Promise<E2EUser> {
  const db = serviceClient();
  const email = `${runId}-${label}@example.test`;
  const password = randomBytes(18).toString("base64url");

  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);

  const profile = await db.from("profiles").insert({ id: data.user.id, display_name: label, role });
  if (profile.error) {
    await db.auth.admin.deleteUser(data.user.id);
    throw new Error(`No se pudo crear el perfil de prueba: ${profile.error.message}`);
  }
  return { id: data.user.id, email, password };
}

export async function deleteE2EUser(id: string): Promise<void> {
  await serviceClient().auth.admin.deleteUser(id);
}
