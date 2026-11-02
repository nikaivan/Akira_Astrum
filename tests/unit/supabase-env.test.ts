import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseEnv } from "@/lib/supabase/env";

const URL_VALUE = "https://example.supabase.co";
const KEY_VALUE = "anon-key-de-prueba";

function stubEnv(url: string, key: string) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
}

describe("getSupabaseEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("devuelve la URL y la clave anónima cuando están definidas", () => {
    stubEnv(URL_VALUE, KEY_VALUE);
    expect(getSupabaseEnv()).toEqual({ url: URL_VALUE, anonKey: KEY_VALUE });
  });

  it.each([
    ["falta la URL", "", KEY_VALUE],
    ["falta la clave anónima", URL_VALUE, ""],
  ])("falla cerrado si %s, con un mensaje genérico", (_caso, url, key) => {
    stubEnv(url, key);
    expect(() => getSupabaseEnv()).toThrow("Configuración no disponible");
  });
});
