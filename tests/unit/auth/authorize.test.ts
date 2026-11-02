import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { authorizeAdmin } from "@/lib/auth/authorize";

type Options = {
  user?: { id: string } | null;
  userError?: unknown;
  getUserThrows?: boolean;
  profile?: { data?: unknown; error?: unknown };
  profileThrows?: boolean;
};

/** Cliente falso: getSession lanza si alguien lo usa para autorizar. */
function fakeClient(options: Options = {}) {
  const queries: { table: string; columns: string; column: string; value: unknown }[] = [];
  const client = {
    auth: {
      getUser: async () => {
        if (options.getUserThrows) throw new Error("red caída");
        return { data: { user: options.user ?? null }, error: options.userError ?? null };
      },
      getSession: () => {
        throw new Error("getSession no debe usarse para autorizar");
      },
    },
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: unknown) => ({
          maybeSingle: async () => {
            queries.push({ table, columns, column, value });
            if (options.profileThrows) throw new Error("consulta caída");
            return { data: options.profile?.data ?? null, error: options.profile?.error ?? null };
          },
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, queries };
}

const USER = { id: "11111111-2222-3333-4444-555555555555" };
const adminProfile = { data: { role: "admin" } };

describe("authorizeAdmin", () => {
  it("permite a un usuario con perfil admin y devuelve solo su id", async () => {
    const { client } = fakeClient({ user: USER, profile: adminProfile });
    expect(await authorizeAdmin(client)).toStrictEqual({ status: "allow", userId: USER.id });
  });

  it("consulta el rol de la tabla profiles del propio usuario autenticado", async () => {
    const { client, queries } = fakeClient({ user: USER, profile: adminProfile });
    await authorizeAdmin(client);
    expect(queries).toEqual([{ table: "profiles", columns: "role", column: "id", value: USER.id }]);
  });

  it("sin usuario: no autenticado y sin consultar el perfil", async () => {
    const { client, queries } = fakeClient({ user: null });
    expect(await authorizeAdmin(client)).toStrictEqual({ status: "unauthenticated" });
    expect(queries).toEqual([]);
  });

  it.each([
    ["sesión ausente", { name: "AuthSessionMissingError", status: 400 }],
    ["token inválido (401)", { name: "AuthApiError", status: 401 }],
    ["sesión inexistente (403)", { name: "AuthApiError", status: 403 }],
  ])("un error de autenticación del cliente (%s) es no autenticado", async (_caso, userError) => {
    const { client, queries } = fakeClient({ user: USER, userError });
    expect(await authorizeAdmin(client)).toStrictEqual({ status: "unauthenticated" });
    expect(queries).toEqual([]);
  });

  it.each([
    ["un fallo de red", { name: "AuthRetryableFetchError", status: 0 }],
    ["un error 500", { name: "AuthApiError", status: 500 }],
    ["un error 503", { name: "AuthApiError", status: 503 }],
    ["un error de forma desconocida", { message: "algo raro" }],
  ])("%s al comprobar la sesión es un error de infraestructura", async (_caso, userError) => {
    const { client } = fakeClient({ user: USER, userError });
    expect(await authorizeAdmin(client)).toStrictEqual({ status: "error" });
  });

  it("si getUser lanza una excepción, es un error de infraestructura", async () => {
    const { client } = fakeClient({ getUserThrows: true });
    expect(await authorizeAdmin(client)).toStrictEqual({ status: "error" });
  });

  it.each([
    ["un usuario sin id", {}],
    ["un id que no es texto", { id: 42 }],
  ])("%s no cuenta como autenticado", async (_caso, user) => {
    const { client } = fakeClient({ user: user as { id: string }, profile: adminProfile });
    expect((await authorizeAdmin(client)).status).toBe("unauthenticated");
  });

  it.each([
    ["rol user", { data: { role: "user" } }],
    ["sin perfil", { data: null }],
    ["rol en mayúsculas", { data: { role: "ADMIN" } }],
    ["rol desconocido", { data: { role: "superuser" } }],
    ["rol nulo", { data: { role: null } }],
    ["rol numérico", { data: { role: 1 } }],
    ["rol que contiene admin", { data: { role: "admin " } }],
    ["fila sin rol", { data: {} }],
    ["una lista en lugar de una fila", { data: [{ role: "admin" }] }],
    ["un texto en lugar de una fila", { data: "admin" }],
  ])("deniega con %s", async (_caso, profile) => {
    const { client } = fakeClient({ user: USER, profile });
    expect(await authorizeAdmin(client)).toStrictEqual({ status: "forbidden" });
  });

  it("si la consulta del perfil devuelve un error, es un error de infraestructura", async () => {
    const { client } = fakeClient({ user: USER, profile: { error: { code: "XX000", message: "fallo" } } });
    expect(await authorizeAdmin(client)).toStrictEqual({ status: "error" });
  });

  it("si la consulta del perfil lanza una excepción, es un error de infraestructura", async () => {
    const { client } = fakeClient({ user: USER, profileThrows: true });
    expect(await authorizeAdmin(client)).toStrictEqual({ status: "error" });
  });

  it("nunca devuelve el usuario ni tokens", async () => {
    const { client } = fakeClient({
      user: { id: USER.id, email: "a@b.c", access_token: "secreto" } as { id: string },
      profile: adminProfile,
    });
    const decision = await authorizeAdmin(client);
    expect(JSON.stringify(decision)).not.toMatch(/secreto|a@b\.c/);
  });
});
