import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { performLogin } from "@/lib/auth/login";
import { GENERIC_LOGIN_ERROR } from "@/lib/auth/messages";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { anonClient } from "./support/api";
import { withTempUser, withUnconfirmedUser } from "./support/service-role";

const GENERIC = { ok: false, message: GENERIC_LOGIN_ERROR };
const WRONG_PASSWORD = "Clave-incorrecta-1";

function formWith(email: string, password: string) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

/** Cada intento usa un limitador nuevo para que el límite de intentos no interfiera. */
const attempt = (supabase: ReturnType<typeof anonClient>, email: string, password: string) =>
  performLogin({ supabase, limiter: createRateLimiter(), ip: "198.51.100.10", formData: formWith(email, password) });

describe("performLogin contra GoTrue real", () => {
  it("correo inexistente y contraseña incorrecta dan exactamente el mismo resultado", async () => {
    await withTempUser("login-same", "admin", async (user) => {
      const unknown = await attempt(anonClient(), `nadie-${randomBytes(6).toString("hex")}@example.test`, WRONG_PASSWORD);
      const wrongPassword = await attempt(anonClient(), user.email, WRONG_PASSWORD);

      expect(unknown).toStrictEqual(GENERIC);
      expect(wrongPassword).toStrictEqual(unknown);
    });
  });

  it("un correo sin confirmar da el mismo resultado, aunque la contraseña sea correcta", async () => {
    await withUnconfirmedUser("login-unconfirmed", async (user) => {
      expect(await attempt(anonClient(), user.email, user.password)).toStrictEqual(GENERIC);
    });
  });

  it("un admin entra y va a /admin", async () => {
    await withTempUser("login-admin", "admin", async (user) => {
      expect(await attempt(anonClient(), user.email, user.password)).toStrictEqual({ ok: true, redirectTo: "/admin" });
    });
  });

  it("un usuario sin rol admin recibe el mismo error y su sesión queda revocada", async () => {
    await withTempUser("login-user", "user", async (user) => {
      const client = anonClient();
      const original = client.auth.signInWithPassword.bind(client.auth);
      let accessToken = "";
      vi.spyOn(client.auth, "signInWithPassword").mockImplementation(async (credentials) => {
        const result = await original(credentials);
        accessToken = result.data.session?.access_token ?? "";
        return result;
      });

      expect(await attempt(client, user.email, user.password)).toStrictEqual(GENERIC);

      expect(accessToken).not.toBe("");
      const { data, error } = await anonClient().auth.getUser(accessToken);
      expect(error).not.toBeNull();
      expect(data.user).toBeNull();
    });
  });
});
