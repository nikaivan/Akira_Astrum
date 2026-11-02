import type { CookieOptions } from "@supabase/ssr";

/** La sesión dura 8 horas (decisión L4). */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/**
 * Opciones de las cookies de sesión. Sobrescriben los valores por defecto de
 * @supabase/ssr (`httpOnly: false`, 400 días). `secure` solo en producción
 * porque en desarrollo se sirve por http.
 */
export function authCookieOptions(env: { NODE_ENV?: string }): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: env.NODE_ENV === "production",
  };
}
