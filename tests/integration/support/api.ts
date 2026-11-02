/* eslint-disable security/detect-object-injection -- claves de un conjunto cerrado de roles de prueba */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, inject } from "vitest";
import { assertTestEnvironment } from "./environment";

export type Role = "anon" | "user" | "noProfile" | "admin";
export const UNPRIVILEGED = ["anon", "user", "noProfile"] as const;

export const OPTIONS = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

export const testUrl = () => assertTestEnvironment(process.env).url;
export const testAnonKey = () => assertTestEnvironment(process.env).anonKey;

/** Cliente sin sesión (clave anónima). */
export const anonClient = (): SupabaseClient => createClient(testUrl(), testAnonKey(), OPTIONS);

export const identityOf = (role: Exclude<Role, "anon">) => inject("fixtures").users[role];

/** Cliente con la sesión que se abrió una sola vez al empezar la ejecución. */
export function clientFor(role: Role): SupabaseClient {
  if (role === "anon") return anonClient();
  const headers = { Authorization: `Bearer ${identityOf(role).accessToken}` };
  return createClient(testUrl(), testAnonKey(), { ...OPTIONS, global: { headers } });
}

/** Cliente con sesión propia (para probar updateUser o iniciar sesión con usuarios temporales). */
export async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  return client;
}

type Result = { data: unknown; error: { code?: string; message?: string } | null };

/**
 * Denegado = error 42501 (sin privilegio o política) o ninguna fila afectada.
 * Las consultas deben terminar en .select() para que una escritura admitida devuelva filas.
 */
export function expectDenied(result: Result): void {
  if (result.error) {
    expect(result.error.code).toBe("42501");
    return;
  }
  expect(result.data ?? []).toEqual([]);
}

/** Comprueba, con la sesión del admin de prueba, si existe una fila con ese valor. */
export async function exists(table: string, column: string, value: string): Promise<boolean> {
  const { data, error } = await clientFor("admin").from(table).select(column).eq(column, value);
  expect(error).toBeNull();
  return (data ?? []).length > 0;
}

export function claimsOf(accessToken: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf-8"));
}
