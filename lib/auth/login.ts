import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeAdmin } from "./authorize";
import { GENERIC_LOGIN_ERROR, RATE_LIMIT_ERROR } from "./messages";
import type { RateLimiter } from "./rate-limit";
import { safeAdminPath } from "./redirect";
import { loginSchema } from "./schema";

export type LoginResult = { ok: true; redirectTo: string } | { ok: false; message: string };
export type LoginState = { message: string } | null;

type Params = { supabase: SupabaseClient; limiter: RateLimiter; ip: string; formData: FormData };

/**
 * Lógica del login, sin dependencias de Next. Todos los fallos (entrada inválida,
 * credenciales, correo sin confirmar, usuario no admin, errores de red) devuelven
 * exactamente el mismo resultado y cuentan como intento fallido.
 */
export async function performLogin({ supabase, limiter, ip, formData }: Params): Promise<LoginResult> {
  if (limiter.isBlocked(ip)) return { ok: false, message: RATE_LIMIT_ERROR };

  const fail = (): LoginResult => {
    limiter.recordFailure(ip);
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  };

  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return fail();

  try {
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data?.user) return fail();
  } catch {
    return fail();
  }

  const decision = await authorizeAdmin(supabase);
  if (decision.status !== "allow") {
    try {
      await supabase.auth.signOut();
    } catch {
      // El resultado no cambia: se devuelve el mismo error genérico.
    }
    return fail();
  }

  limiter.reset(ip);
  return { ok: true, redirectTo: safeAdminPath(formData.get("next")) };
}
