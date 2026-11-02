import { describe, expect, it } from "vitest";
import { authorizeAdmin } from "@/lib/auth/authorize";
import { anonClient, signedInClient } from "./support/api";
import { deleteProfile, withTempUser } from "./support/service-role";

describe("authorizeAdmin con sesiones reales de Supabase", () => {
  it("un admin con sesión es allow y devuelve su id", async () => {
    await withTempUser("authz-admin", "admin", async (user) => {
      const client = await signedInClient(user.email, user.password);
      expect(await authorizeAdmin(client)).toStrictEqual({ status: "allow", userId: user.id });
    });
  });

  it("un usuario con perfil user es forbidden", async () => {
    await withTempUser("authz-user", "user", async (user) => {
      const client = await signedInClient(user.email, user.password);
      expect(await authorizeAdmin(client)).toStrictEqual({ status: "forbidden" });
    });
  });

  it("un usuario sin perfil es forbidden", async () => {
    await withTempUser("authz-noprofile", null, async (user) => {
      const client = await signedInClient(user.email, user.password);
      expect(await authorizeAdmin(client)).toStrictEqual({ status: "forbidden" });
    });
  });

  it("sin sesión es unauthenticated", async () => {
    expect(await authorizeAdmin(anonClient())).toStrictEqual({ status: "unauthenticated" });
  });

  it("si se borra el perfil con la sesión viva, la siguiente comprobación es forbidden", async () => {
    await withTempUser("authz-deleted", "admin", async (user) => {
      const client = await signedInClient(user.email, user.password);
      expect((await authorizeAdmin(client)).status).toBe("allow");

      await deleteProfile(user.id);

      expect(await authorizeAdmin(client)).toStrictEqual({ status: "forbidden" });
    });
  });

  it("si otra sesión del mismo usuario cierra todas las sesiones, esta deja de ser válida", async () => {
    await withTempUser("authz-revoked", "admin", async (user) => {
      const first = await signedInClient(user.email, user.password);
      const second = await signedInClient(user.email, user.password);
      expect((await authorizeAdmin(first)).status).toBe("allow");

      await second.auth.signOut({ scope: "global" });

      expect(await authorizeAdmin(first)).toStrictEqual({ status: "unauthenticated" });
    });
  });

  it("un usuario que se pone role=admin en user_metadata sigue siendo forbidden", async () => {
    await withTempUser("authz-metadata", "user", async (user) => {
      const client = await signedInClient(user.email, user.password);
      expect((await client.auth.updateUser({ data: { role: "admin" } })).error).toBeNull();
      expect((await client.auth.refreshSession()).error).toBeNull();

      expect(await authorizeAdmin(client)).toStrictEqual({ status: "forbidden" });
    });
  });
});
