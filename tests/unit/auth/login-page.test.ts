import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// La acción real habla con Supabase; aquí solo hace falta que exista para pasarla al formulario.
vi.mock("@/lib/auth/actions", () => ({ login: vi.fn(), logout: vi.fn() }));

const { default: LoginPage, metadata } = await import("@/app/login/page");

const render = async (searchParams: Record<string, string | string[] | undefined> = {}) =>
  renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve(searchParams) } as never));
const links = (markup: string) => [...markup.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({ href: match[1].match(/href="([^"]*)"/)?.[1], text: match[2].replace(/<[^>]+>/g, "").trim() }));

describe("página de acceso: la cabecera del sitio permite volver sin los botones del navegador", () => {
  it("muestra la cabecera con la marca (a la portada) y la navegación principal hacia Blog y Compatibilidad", async () => {
    const markup = await render();
    expect(markup).toMatch(/<header[^>]*data-surface="night"/);
    expect(markup).toMatch(/<nav[^>]*aria-label="Principal"/);
    const found = links(markup);
    expect(found).toEqual(expect.arrayContaining([
      { href: "/", text: "Akira Astrum" },
      { href: "/blog", text: "Blog" },
      { href: "/compatibilidad", text: "Compatibilidad" },
    ]));
  });

  it("la cabecera queda antes del formulario y la página sigue teniendo un solo h1 y un solo main", async () => {
    const markup = await render();
    expect(markup.indexOf("<header")).toBeGreaterThanOrEqual(0);
    expect(markup.indexOf("<header")).toBeLessThan(markup.indexOf("<form"));
    expect(markup.match(/<h1\b/g)?.length).toBe(1);
    expect(markup.match(/<main\b/g)?.length).toBe(1);
    expect(markup).toContain("Acceso a la intranet");
  });

  it("conserva el formulario: correo, contraseña y botón", async () => {
    const markup = await render();
    expect(markup).toMatch(/<label[^>]*>Correo electrónico<\/label>/);
    expect(markup).toMatch(/<label[^>]*>Contraseña<\/label>/);
    expect(markup).toMatch(/<button[^>]*>Iniciar sesión<\/button>/);
  });

  it("el pie de la página de acceso no enlaza a sí misma: sin «Intranet», pero con el aviso y la superficie noche", async () => {
    const markup = await render();
    expect(markup).toMatch(/<footer[^>]*data-surface="night"/);
    expect(markup).toContain("© Akira Astrum");
    expect(links(markup).filter((link) => link.href === "/login" || link.text === "Intranet")).toEqual([]);
  });

  it("no enlaza a ninguna página de registro", async () => {
    const hrefs = links(await render()).map((link) => link.href ?? "");
    expect(hrefs.filter((href) => /regist|signup|sign-up/i.test(href))).toEqual([]);
  });

  it("el destino tras el acceso sigue limpiándose (un destino malicioso no llega al formulario)", async () => {
    expect(await render({ next: "//evil.com" })).not.toContain("evil.com");
  });

  it("sigue sin indexarse", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
