import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";
import { assertTestEnvironment } from "../../integration/support/environment";

/**
 * Deja en el contexto las cookies de sesión de un usuario, generadas con el propio @supabase/ssr
 * (mismo nombre y codificación que usa la aplicación), sin pasar por el formulario de login.
 */
export async function addSessionCookies(context: BrowserContext, email: string, password: string): Promise<void> {
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

  await context.addCookies(
    [...captured].map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax" as const,
      secure: false,
    })),
  );
}
