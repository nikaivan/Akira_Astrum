import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect, unstable_rethrow } from "next/navigation";
import { recordSecurityEvent } from "@/lib/security/log";
import { createClient } from "@/lib/supabase/server";
import { authorizeAdmin, type AdminDecision } from "./authorize";
import { PRIVATE_HEADERS } from "./private-headers";

export type AdminContext = { supabase: SupabaseClient; userId: string };

async function currentAdmin(): Promise<{ decision: AdminDecision; supabase: SupabaseClient | null }> {
  try {
    const supabase = await createClient();
    return { decision: await authorizeAdmin(supabase), supabase };
  } catch (error) {
    // Los errores internos de Next (redirect, notFound o el aviso de uso dinámico de cookies()) no son
    // un fallo: si se capturaran, el build de /admin fallaría. Cualquier otro error falla cerrado.
    unstable_rethrow(error);
    return { decision: { status: "error" }, supabase: null };
  }
}

/**
 * Capa 2 (acceso a datos): páginas y layouts de /admin. Vuelve a llamar a
 * `getUser()` aunque el proxy ya lo haya hecho. Falla cerrado.
 */
/** Registra una denegación de la capa 2 (A09); sin sesión no es un evento: es una visita anónima normal. */
function recordDenied(decision: AdminDecision, route?: string) {
  if (decision.status !== "forbidden" && decision.status !== "error") return;
  recordSecurityEvent({ event: "access_denied", reason: decision.status === "forbidden" ? "forbidden" : "service_error", layer: "page", route });
}

export async function requireAdmin(): Promise<AdminContext> {
  const { decision, supabase } = await currentAdmin();
  if (decision.status === "unauthenticated") redirect("/login");
  recordDenied(decision);
  if (decision.status !== "allow" || !supabase) throw new Error("Acceso denegado");
  return { supabase, userId: decision.userId };
}

/** Capa 2 para Server Actions de /admin: comprueba al admin en cada llamada. */
export function withAdminAction<Args extends unknown[], Result>(
  action: (context: AdminContext, ...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args) => action(await requireAdmin(), ...args);
}

const json = (status: number, error: string) =>
  Response.json({ error }, { status, headers: Object.fromEntries(PRIVATE_HEADERS.map(({ key, value }) => [key, value])) });

/** Capa 2 para Route Handlers de /admin: 401, 403 o 503 genéricos en JSON. */
export function withAdminRoute<Args extends unknown[]>(
  handler: (request: Request, context: AdminContext, ...args: Args) => Promise<Response>,
): (request: Request, ...args: Args) => Promise<Response> {
  return async (request, ...args) => {
    const { decision, supabase } = await currentAdmin();
    if (decision.status === "unauthenticated") return json(401, "No autenticado");
    recordDenied(decision, new URL(request.url).pathname);
    if (decision.status === "forbidden") return json(403, "Acceso denegado");
    if (decision.status !== "allow" || !supabase) return json(503, "Servicio no disponible");
    return handler(request, { supabase, userId: decision.userId }, ...args);
  };
}
