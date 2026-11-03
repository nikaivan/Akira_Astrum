import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Cliente de lectura para las páginas públicas: clave pública y sin sesión.
 * No lee cookies, así que un admin con la sesión abierta ve lo mismo que un visitante
 * (nunca borradores) y la página no depende de quién la pide.
 */
export function createPublicClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
