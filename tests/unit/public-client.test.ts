import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicClient } from "@/lib/supabase/public";

afterEach(() => vi.unstubAllEnvs());

describe("createPublicClient", () => {
  it("crea un cliente con la clave pública", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "clave-anonima-de-prueba");
    expect(typeof createPublicClient().from).toBe("function");
  });

  it("no tiene sesión: no lee cookies ni almacenamiento", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "clave-anonima-de-prueba");
    const { data } = await createPublicClient().auth.getSession();
    expect(data.session).toBeNull();
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])("sin %s falla con un mensaje genérico", (name) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "clave-anonima-de-prueba");
    vi.stubEnv(name, "");
    expect(() => createPublicClient()).toThrow("Configuración no disponible");
  });
});
