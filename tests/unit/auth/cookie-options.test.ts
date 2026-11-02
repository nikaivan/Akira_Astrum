import { describe, expect, it } from "vitest";
import { authCookieOptions, SESSION_MAX_AGE_SECONDS } from "@/lib/supabase/cookie-options";

describe("authCookieOptions", () => {
  it("la sesión dura 8 horas", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);
  });

  it.each(["production", "development", "test", undefined])("en %s: httpOnly, lax, ruta raíz y 8 horas", (nodeEnv) => {
    expect(authCookieOptions({ NODE_ENV: nodeEnv })).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 28_800,
    });
  });

  it("es secure en producción", () => {
    expect(authCookieOptions({ NODE_ENV: "production" }).secure).toBe(true);
  });

  it.each(["development", "test", undefined])("no es secure en %s (se sirve por http)", (nodeEnv) => {
    expect(authCookieOptions({ NODE_ENV: nodeEnv }).secure).toBe(false);
  });

  it("nunca usa los 400 días por defecto de @supabase/ssr ni deja la cookie legible por JavaScript", () => {
    for (const nodeEnv of ["production", "development"]) {
      const options = authCookieOptions({ NODE_ENV: nodeEnv });
      expect(options.maxAge).toBeLessThan(400 * 24 * 60 * 60);
      expect(options.httpOnly).not.toBe(false);
    }
  });
});
