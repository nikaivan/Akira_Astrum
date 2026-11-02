import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it, inject } from "vitest";
import { anonClient, clientFor, identityOf, testAnonKey, testUrl } from "./support/api";
import { cleanupPrefix } from "./support/service-role";

afterAll(async () => {
  await cleanupPrefix(inject("fixtures").runId);
});

describe("configuración de autenticación", () => {
  it("el registro público está desactivado", async () => {
    const { data, error } = await anonClient().auth.signUp({
      email: `${inject("fixtures").runId}-registro@example.test`,
      password: randomBytes(18).toString("base64url"),
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });
});

describe("tokens inválidos", () => {
  const getPosts = (token: string) =>
    fetch(`${testUrl()}/rest/v1/posts?select=id`, {
      headers: { apikey: testAnonKey(), Authorization: `Bearer ${token}` },
    });

  it("un token inventado se rechaza con 401 y sin datos", async () => {
    const response = await getPosts("no.es.un-token");
    expect(response.status).toBe(401);
    expect(Array.isArray(await response.json())).toBe(false);
  });

  it("un token del admin con la firma alterada se rechaza con 401 y sin datos", async () => {
    const [header, payload, signature] = identityOf("admin").accessToken.split(".");
    const tampered = `${header}.${payload}.${signature.slice(0, -4)}AAAA`;
    const response = await getPosts(tampered);
    expect(response.status).toBe(401);
    expect(Array.isArray(await response.json())).toBe(false);
  });
});

describe("funciones no expuestas", () => {
  it.each(["anon", "admin"] as const)("%s no puede llamar a is_admin() por la API", async (role) => {
    const { data, error } = await clientFor(role).rpc("is_admin");
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});
