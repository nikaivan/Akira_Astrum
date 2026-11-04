import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminDecision } from "@/lib/auth/authorize";

const authorize = vi.hoisted(() => vi.fn<() => Promise<AdminDecision>>());
vi.mock("@/lib/auth/authorize", () => ({ authorizeAdmin: authorize }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));

import { requireAdmin, withAdminRoute } from "@/lib/auth/require-admin";
import { setSecuritySink } from "@/lib/security/log";
import { proxy } from "@/proxy";

const ORIGIN = "http://localhost:3100";
let lines: string[] = [];
const events = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefgh.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-de-prueba");
  lines = [];
  setSecuritySink((line) => lines.push(line));
});
afterEach(() => {
  setSecuritySink(null);
  vi.unstubAllEnvs();
  authorize.mockReset();
});

describe("proxy: access_denied", () => {
  it.each([
    ["forbidden", { status: "forbidden" } as AdminDecision, 403],
    ["error", { status: "error" } as AdminDecision, 503],
  ])("%s registra un evento de la capa proxy, con la ruta sin la consulta", async (_name, decision, status) => {
    authorize.mockResolvedValue(decision);
    const response = await proxy(new NextRequest(`${ORIGIN}/admin/posts?token=secreto#ancla`, { headers: { "x-forwarded-for": "203.0.113.9" } }));

    expect(response.status).toBe(status);
    const reason = decision.status === "forbidden" ? "forbidden" : "service_error";
    expect(events()).toEqual([expect.objectContaining({ event: "access_denied", level: "warn", reason, layer: "proxy", route: "/admin/posts" })]);
    const text = lines.join("\n");
    for (const secret of ["secreto", "ancla", "203.0.113.9"]) expect(text).not.toContain(secret);
  });

  it("una excepción al autorizar también se registra como service_error y sigue denegando", async () => {
    authorize.mockRejectedValue(new Error("Supabase caído"));
    const response = await proxy(new NextRequest(`${ORIGIN}/admin`));
    expect(response.status).toBe(503);
    expect(events()).toEqual([expect.objectContaining({ event: "access_denied", reason: "service_error" })]);
    expect(lines.join("\n")).not.toContain("Supabase caído");
  });

  it("sin sesión (unauthenticated) no se registra nada: cada visita anónima a /admin es normal", async () => {
    authorize.mockResolvedValue({ status: "unauthenticated" });
    expect((await proxy(new NextRequest(`${ORIGIN}/admin`))).status).toBe(307);
    expect(events()).toEqual([]);
  });

  it("un admin autorizado y las páginas públicas no registran nada", async () => {
    authorize.mockResolvedValue({ status: "allow", userId: "u1" });
    await proxy(new NextRequest(`${ORIGIN}/admin`));
    await proxy(new NextRequest(`${ORIGIN}/blog`));
    expect(events()).toEqual([]);
  });

  it("el registro no cambia la respuesta: con un sumidero que lanza, sigue siendo 403 con las mismas cabeceras", async () => {
    authorize.mockResolvedValue({ status: "forbidden" });
    const normal = await proxy(new NextRequest(`${ORIGIN}/admin`));
    setSecuritySink(() => {
      throw new Error("el registro ha fallado");
    });
    const broken = await proxy(new NextRequest(`${ORIGIN}/admin`));
    expect(broken.status).toBe(normal.status);
    expect(broken.headers.get("cache-control")).toBe(normal.headers.get("cache-control"));
    expect(broken.headers.get("x-robots-tag")).toBe(normal.headers.get("x-robots-tag"));
    expect(await broken.text()).toBe(await normal.text());
  });
});

describe("capa 2: access_denied", () => {
  it("requireAdmin: un no admin registra forbidden en la capa page y se le deniega", async () => {
    authorize.mockResolvedValue({ status: "forbidden" });
    await expect(requireAdmin()).rejects.toThrow("Acceso denegado");
    expect(events()).toEqual([expect.objectContaining({ event: "access_denied", reason: "forbidden", layer: "page" })]);
  });

  it("requireAdmin: un error del servicio registra service_error", async () => {
    authorize.mockResolvedValue({ status: "error" });
    await expect(requireAdmin()).rejects.toThrow("Acceso denegado");
    expect(events()).toEqual([expect.objectContaining({ reason: "service_error", layer: "page" })]);
  });

  it("requireAdmin: sin sesión redirige sin registrar nada", async () => {
    authorize.mockResolvedValue({ status: "unauthenticated" });
    await expect(requireAdmin()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(events()).toEqual([]);
  });

  it("withAdminRoute: 403 y 503 registran el evento con la ruta de la petición, sin consulta", async () => {
    const route = withAdminRoute(async () => new Response("ok"));
    authorize.mockResolvedValue({ status: "forbidden" });
    expect((await route(new Request("http://localhost/admin/api/x?clave=secreto"))).status).toBe(403);
    authorize.mockResolvedValue({ status: "error" });
    expect((await route(new Request("http://localhost/admin/api/x"))).status).toBe(503);

    expect(events()).toEqual([
      expect.objectContaining({ event: "access_denied", reason: "forbidden", layer: "page", route: "/admin/api/x" }),
      expect.objectContaining({ event: "access_denied", reason: "service_error", layer: "page", route: "/admin/api/x" }),
    ]);
    expect(lines.join("\n")).not.toContain("secreto");
  });

  it("withAdminRoute: 401 sin sesión no registra nada", async () => {
    authorize.mockResolvedValue({ status: "unauthenticated" });
    expect((await withAdminRoute(async () => new Response("ok"))(new Request("http://localhost/admin/api/x"))).status).toBe(401);
    expect(events()).toEqual([]);
  });

  it("el registro no cambia la respuesta de withAdminRoute si el sumidero lanza", async () => {
    authorize.mockResolvedValue({ status: "forbidden" });
    setSecuritySink(() => {
      throw new Error("el registro ha fallado");
    });
    const response = await withAdminRoute(async () => new Response("ok"))(new Request("http://localhost/admin/api/x"));
    expect(response.status).toBe(403);
  });
});
