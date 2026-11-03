import { createServerClient } from "@supabase/ssr";
import type { BrowserContext, Cookie } from "@playwright/test";
import { assertTestEnvironment } from "../../integration/support/environment";

type SessionCookie = Pick<Cookie, "name" | "value" | "domain" | "path" | "httpOnly" | "sameSite" | "secure">;

/**
 * Inicia sesión una vez y devuelve las cookies de sesión, generadas con el propio @supabase/ssr
 * (mismo nombre y codificación que usa la aplicación). Cada inicio de sesión cuenta para el límite de
 * Supabase Auth: quien necesite la sesión en muchos tests debe reutilizar estas cookies.
 */
export async function createSessionCookies(email: string, password: string): Promise<SessionCookie[]> {
  const { url, anonKey } = assertTestEnvironment(process.env);
  const captured = new Map<string, string>();

  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...captured].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) captured.set(name, value);
      },
    },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error("No se pudo iniciar sesión con el usuario de prueba.");

  // @supabase/ssr escribe las cookies al procesar el evento de sesión, de forma asíncrona.
  for (let i = 0; i < 30 && captured.size === 0; i++) await new Promise((resolve) => setTimeout(resolve, 100));
  if (captured.size === 0) throw new Error("No se generaron las cookies de sesión.");

  return [...captured].map(([name, value]) => ({
    name,
    value,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    secure: false,
  }));
}

/** Deja en el contexto las cookies de sesión de un usuario, sin pasar por el formulario de login. */
export async function addSessionCookies(context: BrowserContext, email: string, password: string): Promise<void> {
  await context.addCookies(await createSessionCookies(email, password));
}
