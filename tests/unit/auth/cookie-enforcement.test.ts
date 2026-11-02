import { describe, expect, it } from "vitest";
import { enforceSessionCookieOptions, SESSION_MAX_AGE_SECONDS } from "@/lib/supabase/cookie-options";

const FOUR_HUNDRED_DAYS = 400 * 24 * 60 * 60;

describe("enforceSessionCookieOptions", () => {
  it("sustituye los 400 días que @supabase/ssr impone al escribir la sesión", () => {
    const options = enforceSessionCookieOptions({ maxAge: FOUR_HUNDRED_DAYS, httpOnly: false, sameSite: "lax", path: "/" }, { NODE_ENV: "production" });
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_SECONDS, secure: true });
  });

  it("también fija las opciones cuando @supabase/ssr no envía ninguna", () => {
    expect(enforceSessionCookieOptions(undefined, { NODE_ENV: "development" })).toMatchObject({
      httpOnly: true,
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: false,
    });
  });

  it("no alarga una caducidad menor que la de la sesión", () => {
    expect(enforceSessionCookieOptions({ maxAge: 60 }, { NODE_ENV: "production" }).maxAge).toBe(60);
  });

  it("respeta el borrado de cookies (maxAge 0), pero sigue siendo httpOnly", () => {
    const options = enforceSessionCookieOptions({ maxAge: 0, expires: new Date(0) }, { NODE_ENV: "production" });
    expect(options.maxAge).toBe(0);
    expect(options.expires).toEqual(new Date(0));
    expect(options.httpOnly).toBe(true);
  });
});
