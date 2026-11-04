import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminDecision } from "@/lib/auth/authorize";

const authorize = vi.hoisted(() => vi.fn<() => Promise<AdminDecision>>());
vi.mock("@/lib/auth/authorize", () => ({ authorizeAdmin: authorize }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({}) }));

import { config, proxy } from "@/proxy";

const ORIGIN = "http://localhost:3100";
const STORAGE = "https://abcdefgh.supabase.co";
const get = (path: string) => new NextRequest(`${ORIGIN}${path}`);
const policyOf = (response: Response) => response.headers.get("content-security-policy") ?? "";
const nonceOf = (policy: string) => /'nonce-([A-Za-z0-9+/=]+)'/.exec(policy)?.[1];

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", STORAGE);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-de-prueba");
  authorize.mockResolvedValue({ status: "allow", userId: "u1" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  authorize.mockReset();
});

describe("proxy: rutas públicas", () => {
  it.each(["/", "/blog", "/blog/una-entrada", "/categorias/luna", "/compatibilidad", "/login", "/ruta-que-no-existe"])("%s responde con CSP y nonce", async (path) => {
    const response = await proxy(get(path));
    const policy = policyOf(response);
    expect(policy).toContain("default-src 'self'");
    expect(nonceOf(policy)).toBeTruthy();
    expect(policy).toContain(`img-src 'self' blob: ${STORAGE}`);
  });

  it("reenvía la CSP y el nonce a la renderización (Next los lee de la petición para marcar sus scripts)", async () => {
    const response = await proxy(get("/"));
    const policy = policyOf(response);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonceOf(policy));
  });

  it("cada petición usa un nonce distinto", async () => {
    const nonces = new Set<string | undefined>();
    for (let i = 0; i < 20; i++) nonces.add(nonceOf(policyOf(await proxy(get("/")))));
    expect(nonces.size).toBe(20);
  });

  it("no consulta la autorización: las rutas públicas no dependen de Supabase", async () => {
    await proxy(get("/blog"));
    expect(authorize).not.toHaveBeenCalled();
  });

  it("un nonce o un x-nonce enviados por el cliente se ignoran", async () => {
    const hostile = new NextRequest(`${ORIGIN}/`, { headers: { "x-nonce": "AAAA", "content-security-policy": "default-src *" } });
    const policy = policyOf(await proxy(hostile));
    expect(nonceOf(policy)).not.toBe("AAAA");
    expect(policy).not.toContain("default-src *");
  });

  it("sin la variable de Supabase la política sigue siendo válida y estricta (solo 'self' y blob:)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(policyOf(await proxy(get("/")))).toMatch(/img-src 'self' blob:(;|$)/);
  });
});

describe("proxy: /admin", () => {
  const decisions: [string, AdminDecision, number][] = [
    ["allow", { status: "allow", userId: "u1" }, 200],
    ["unauthenticated", { status: "unauthenticated" }, 307],
    ["forbidden", { status: "forbidden" }, 403],
    ["error", { status: "error" }, 503],
  ];

  it.each(decisions)("%s: el estado no cambia y la respuesta lleva CSP", async (_name, decision, status) => {
    authorize.mockResolvedValue(decision);
    const response = await proxy(get("/admin/posts"));
    expect(response.status).toBe(status);
    expect(policyOf(response)).toContain("frame-ancestors 'none'");
    expect(nonceOf(policyOf(response))).toBeTruthy();
  });

  it.each(decisions)("%s: conserva noindex y no-store", async (_name, decision) => {
    authorize.mockResolvedValue(decision);
    const response = await proxy(get("/admin/posts"));
    expect(response.headers.get("x-robots-tag")).toMatch(/noindex/);
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("allow: reenvía el nonce y la CSP a la renderización del panel", async () => {
    const response = await proxy(get("/admin"));
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonceOf(policyOf(response)));
  });

  it("unauthenticated sigue redirigiendo a /login conservando la ruta pedida", async () => {
    authorize.mockResolvedValue({ status: "unauthenticated" });
    const response = await proxy(get("/admin/posts"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/admin/posts");
  });

  it("fallo cerrado: si la autorización lanza una excepción, se deniega con 503 y CSP", async () => {
    authorize.mockRejectedValue(new Error("Supabase caído"));
    const response = await proxy(get("/admin"));
    expect(response.status).toBe(503);
    expect(policyOf(response)).toContain("default-src 'self'");
    expect(await response.text()).not.toMatch(/Supabase caído|stack/i);
  });

  it("fallo cerrado: sin la configuración de Supabase se deniega y sigue habiendo CSP", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const response = await proxy(get("/admin"));
    expect(response.status).toBe(503);
    expect(policyOf(response)).toContain("default-src 'self'");
  });
});

describe("proxy: matcher", () => {
  const matchers = ([] as unknown[]).concat(config.matcher);
  const sources = matchers.map((matcher) => (typeof matcher === "string" ? matcher : (matcher as { source: string }).source));
  const pattern = (source: string) => new RegExp(`^${source}$`);
  const covers = (path: string) => sources.some((source) => pattern(source.replace(/:path\*/, ".*")).test(path));

  it("sigue cubriendo /admin", () => {
    expect(sources).toContain("/admin/:path*");
  });

  it.each(["/", "/blog", "/blog/x", "/categorias/x", "/compatibilidad", "/login", "/admin/posts", "/no-existe"])("cubre %s", (path) => {
    expect(covers(path)).toBe(true);
  });

  it.each(["/_next/static/chunks/a.js", "/_next/image", "/favicon.ico"])("no pasa por el proxy: %s", (path) => {
    const open = sources.filter((source) => source !== "/admin/:path*");
    expect(open.some((source) => pattern(source).test(path))).toBe(false);
  });

  it("las precargas de next/link no generan un nonce nuevo", () => {
    const rule = matchers.find((matcher) => typeof matcher === "object") as { missing?: { key: string }[] } | undefined;
    expect(rule?.missing?.map((condition) => condition.key)).toEqual(expect.arrayContaining(["next-router-prefetch", "purpose"]));
  });
});
