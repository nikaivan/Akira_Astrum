import type { SupabaseClient } from "@supabase/supabase-js";
import { recordSecurityEvent } from "@/lib/security/log";
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
type FailReason = "invalid_input" | "credentials" | "not_admin" | "service_error";

/** Errores 4xx de Auth son credenciales incorrectas; cualquier otro (red, 5xx) es un fallo del servicio. */
const reasonOf = (error: unknown): FailReason => {
  const status = typeof error === "object" && error !== null ? (error as { status?: unknown }).status : undefined;
  return typeof status === "number" && status >= 400 && status < 500 ? "credentials" : "service_error";
};

export async function performLogin({ supabase, limiter, ip, formData }: Params): Promise<LoginResult> {
  if (limiter.isBlocked(ip)) {
    recordSecurityEvent({ event: "rate_limited", scope: "login", ip });
    return { ok: false, message: RATE_LIMIT_ERROR };
  }

  // El motivo solo existe en el registro de eventos: al usuario siempre se le devuelve el mismo mensaje.
  const fail = (reason: FailReason): LoginResult => {
    recordSecurityEvent({ event: "login_failed", reason, ip });
    limiter.recordFailure(ip);
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  };

  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return fail("invalid_input");

  try {
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return fail(reasonOf(error));
    if (!data?.user) return fail("credentials");
  } catch {
    return fail("service_error");
  }

  const decision = await authorizeAdmin(supabase);
  if (decision.status !== "allow") {
    try {
      await supabase.auth.signOut();
    } catch {
      // El resultado no cambia: se devuelve el mismo error genérico.
    }
    return fail(decision.status === "forbidden" ? "not_admin" : "service_error");
  }

  recordSecurityEvent({ event: "login_succeeded", user: decision.userId, ip });
  limiter.reset(ip);
  return { ok: true, redirectTo: safeAdminPath(formData.get("next")) };
}
