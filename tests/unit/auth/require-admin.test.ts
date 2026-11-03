import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const { createClient } = await import("@/lib/supabase/server");
const { requireAdmin, withAdminRoute } = await import("@/lib/auth/require-admin");

// Errores internos de Next: los lanzan redirect(), notFound() y cookies() al detectar uso dinámico.
// Si se capturaran como un fallo cualquiera, el build se rompería (/admin) y las redirecciones no funcionarían.
const nextRedirect = () => Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
const nextNotFound = () => Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });

beforeEach(() => {
  vi.mocked(createClient).mockReset();
});

// Lanza solo cuando se llama (un rechazo creado antes de tiempo cuenta como error sin manejar).
const failWith = (error: Error): void => {
  vi.mocked(createClient).mockImplementation(async () => {
    throw error;
  });
};

describe("requireAdmin: los errores internos de Next no se capturan", () => {
  it.each([
    ["una redirección", nextRedirect],
    ["un notFound", nextNotFound],
  ])("deja pasar %s tal cual", async (_caso, make) => {
    const internal = make();
    failWith(internal);
    await expect(requireAdmin()).rejects.toBe(internal);
  });

  it("sigue fallando cerrado ante cualquier otro error, sin filtrar su mensaje", async () => {
    failWith(new Error("fallo interno contraseña=secreto"));
    const failure = await requireAdmin().then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toEqual(new Error("Acceso denegado"));
    expect(String((failure as Error).message)).not.toMatch(/secreto/);
  });
});

describe("withAdminRoute: los errores internos de Next no se capturan", () => {
  it("deja pasar una redirección", async () => {
    const internal = nextRedirect();
    failWith(internal);
    await expect(withAdminRoute(async () => new Response("ok"))(new Request("http://localhost/admin/x"))).rejects.toBe(internal);
  });

  it("ante cualquier otro error responde 503 genérico, sin detalles", async () => {
    failWith(new Error("fallo interno contraseña=secreto"));
    const response = await withAdminRoute(async () => new Response("ok"))(new Request("http://localhost/admin/x"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/secreto|fallo interno/);
  });
});
