import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import type { AdminDecision } from "@/lib/auth/authorize";
import { adminResponse } from "@/lib/auth/proxy-response";

const ORIGIN = "http://localhost:3100";
const request = (path = "/admin/posts?page=2") => new NextRequest(`${ORIGIN}${path}`);
const next = () => NextResponse.next();

const decisions: [string, AdminDecision][] = [
  ["allow", { status: "allow", userId: "u1" }],
  ["unauthenticated", { status: "unauthenticated" }],
  ["forbidden", { status: "forbidden" }],
  ["error", { status: "error" }],
];

describe("adminResponse", () => {
  it("allow: continúa con la petición", () => {
    const response = adminResponse({ status: "allow", userId: "u1" }, request(), next());
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("unauthenticated: redirige a /login conservando la ruta pedida, sin salir del origen", () => {
    const response = adminResponse({ status: "unauthenticated" }, request("/admin/posts?page=2"), next());
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/admin/posts?page=2");
  });

  it("unauthenticated: la ruta de destino siempre es una ruta segura de /admin", () => {
    const response = adminResponse({ status: "unauthenticated" }, request("/admin"), next());
    expect(new URL(response.headers.get("location") ?? "").searchParams.get("next")).toBe("/admin");
  });

  it("forbidden: responde 403 sin contenido del panel", async () => {
    const response = adminResponse({ status: "forbidden" }, request(), next());
    expect(response.status).toBe(403);
    expect(response.headers.get("location")).toBeNull();
    const body = await response.text();
    expect(body).not.toMatch(/Panel de administración|Cerrar sesión/);
  });

  it("error: responde 503 genérico, sin detalles internos", async () => {
    const response = adminResponse({ status: "error" }, request(), next());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/supabase|error:|stack|at /i);
  });

  it("las cookies refrescadas por Supabase se conservan al redirigir", () => {
    const passthrough = next();
    passthrough.cookies.set("sb-prueba-auth-token", "refrescada", { httpOnly: true });
    const response = adminResponse({ status: "unauthenticated" }, request(), passthrough);
    expect(response.cookies.get("sb-prueba-auth-token")?.value).toBe("refrescada");
  });

  it("las cabeceras de caché que pide Supabase se copian a la respuesta que continúa", () => {
    const passthrough = next();
    passthrough.headers.set("Pragma", "no-cache");
    const response = adminResponse({ status: "allow", userId: "u1" }, request(), passthrough);
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it.each(decisions)("%s: nunca se indexa ni se guarda en caché", (_nombre, decision) => {
    const response = adminResponse(decision, request(), next());
    expect(response.headers.get("x-robots-tag")).toMatch(/noindex/);
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
  });
});
