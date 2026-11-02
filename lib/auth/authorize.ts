import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminDecision =
  | { status: "allow"; userId: string }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "error" };

const AUTH_FAILURE_STATUSES = new Set([400, 401, 403]);

function isAuthFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, status } = error as { name?: unknown; status?: unknown };
  return name === "AuthSessionMissingError" || (typeof status === "number" && AUTH_FAILURE_STATUSES.has(status));
}

function roleOf(row: unknown): unknown {
  return typeof row === "object" && row !== null && !Array.isArray(row) ? (row as { role?: unknown }).role : undefined;
}

/**
 * Decide si la petición viene de un admin (A01, A07, A10). Usa `getUser()`, que
 * valida el token contra Supabase Auth (nunca `getSession()`), y lee el rol de
 * `profiles` con el JWT del propio usuario (RLS `profiles_select_own`), no de
 * `user_metadata`. Falla cerrado: cualquier duda deniega.
 */
export async function authorizeAdmin(supabase: SupabaseClient): Promise<AdminDecision> {
  let userId: string;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return isAuthFailure(error) ? { status: "unauthenticated" } : { status: "error" };
    const id: unknown = data?.user?.id;
    if (typeof id !== "string" || id === "") return { status: "unauthenticated" };
    userId = id;
  } catch {
    return { status: "error" };
  }

  try {
    const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (error) return { status: "error" };
    return roleOf(data) === "admin" ? { status: "allow", userId } : { status: "forbidden" };
  } catch {
    return { status: "error" };
  }
}
