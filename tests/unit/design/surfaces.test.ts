import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeHero } from "@/components/home-hero";
import { PageBanner } from "@/components/page-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** Marco y cabeceras de la web pública: superficie noche, estructura accesible intacta y adornos ocultos a los lectores de pantalla. */
const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
const NIGHT = /data-surface="night"/;
const h1s = (markup: string) => [...markup.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((match) => match[1].replace(/<[^>]+>/g, "").trim());
const links = (markup: string) => [...markup.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({ attributes: match[1], text: match[2].replace(/<[^>]+>/g, "").trim() }));
const hrefOf = (attributes: string) => attributes.match(/href="([^"]*)"/)?.[1];
const svgs = (markup: string) => markup.match(/<svg\b[^>]*>/g) ?? [];

describe("cabecera del sitio", () => {
  const markup = html(createElement(SiteHeader));

  it("es la superficie noche", () => {
    expect(markup).toMatch(/<header[^>]*data-surface="night"/);
  });

  it("lleva la marca como enlace a la portada y la navegación principal con Blog y Compatibilidad", () => {
    const found = links(markup);
    expect(found.find((link) => link.text === "Akira Astrum" && hrefOf(link.attributes) === "/")).toBeTruthy();
    expect(found.find((link) => link.text === "Blog" && hrefOf(link.attributes) === "/blog")).toBeTruthy();
    expect(found.find((link) => link.text === "Compatibilidad" && hrefOf(link.attributes) === "/compatibilidad")).toBeTruthy();
    expect(markup).toMatch(/<nav[^>]*aria-label="Principal"/);
  });

  it("todos los enlaces miden al menos 44 px de alto", () => {
    for (const link of links(markup)) expect(link.attributes).toMatch(/min-h-11|h-11/);
  });

  it.each([
    ["blog", "Blog"],
    ["compatibility", "Compatibilidad"],
  ] as const)("marca la sección actual (%s) con aria-current y solo esa", (current, label) => {
    const found = links(html(createElement(SiteHeader, { current })));
    expect(found.filter((link) => /aria-current="page"/.test(link.attributes)).map((link) => link.text)).toEqual([label]);
  });

  it("no añade ningún texto nuevo: los adornos están ocultos a los lectores de pantalla", () => {
    for (const tag of svgs(markup)) expect(tag).toMatch(/aria-hidden="true"/);
    expect(markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).toBe("Akira Astrum Blog Compatibilidad");
  });
});

describe("pie del sitio", () => {
  const markup = html(createElement(SiteFooter));

  it("es la superficie noche y conserva el aviso y el enlace a la intranet", () => {
    expect(markup).toMatch(/<footer[^>]*data-surface="night"/);
    expect(markup).toContain("© Akira Astrum");
    expect(links(markup).find((link) => link.text === "Intranet" && hrefOf(link.attributes) === "/login")).toBeTruthy();
  });

  it("los adornos están ocultos a los lectores de pantalla", () => {
    for (const tag of svgs(markup)) expect(tag).toMatch(/aria-hidden="true"/);
  });

  it("sin el enlace a la intranet (para la propia página de acceso) conserva el aviso y la superficie noche", () => {
    const sin = html(createElement(SiteFooter, { intranetLink: false }));
    expect(sin).toMatch(/<footer[^>]*data-surface="night"/);
    expect(sin).toContain("© Akira Astrum");
    expect(links(sin)).toEqual([]);
    expect(sin).not.toContain("Intranet");
  });
});

describe("héroe de la portada", () => {
  const markup = html(createElement(HomeHero));

  it("es la superficie noche con un único h1 «Akira Astrum»", () => {
    expect(markup).toMatch(NIGHT);
    expect(h1s(markup)).toEqual(["Akira Astrum"]);
  });

  it("conserva el texto de presentación y el botón hacia la calculadora", () => {
    expect(markup).toContain("Astrología con calma: lecturas serenas y una calculadora de compatibilidad entre signos.");
    const cta = links(markup).find((link) => link.text === "Calcular compatibilidad");
    expect(cta && hrefOf(cta.attributes)).toBe("/compatibilidad");
    expect(cta?.attributes).toMatch(/min-h-11|h-11/);
  });

  it("los adornos (constelaciones, ornamentos) están ocultos a los lectores de pantalla", () => {
    expect(svgs(markup).length).toBeGreaterThan(0);
    for (const tag of svgs(markup)) expect(tag).toMatch(/aria-hidden="true"/);
  });
});

describe("banda de título de una página", () => {
  it("es la superficie noche con un único h1 y, si se da, su descripción", () => {
    const markup = html(createElement(PageBanner, { title: "Compatibilidad entre signos", description: "Introduce las dos fechas." }));
    expect(markup).toMatch(NIGHT);
    expect(h1s(markup)).toEqual(["Compatibilidad entre signos"]);
    expect(markup).toContain("Introduce las dos fechas.");
  });

  it("sin descripción solo pinta el título", () => {
    const markup = html(createElement(PageBanner, { title: "Blog" }));
    expect(h1s(markup)).toEqual(["Blog"]);
    expect(markup.match(/<p\b/g) ?? []).toEqual([]);
  });

  it("el título se pinta como texto (nada de HTML)", () => {
    const markup = html(createElement(PageBanner, { title: "<img src=x onerror=alert(1)>" }));
    expect(markup).not.toMatch(/<img/);
    expect(markup).toContain("&lt;img");
  });

  it("los adornos están ocultos a los lectores de pantalla", () => {
    for (const tag of svgs(html(createElement(PageBanner, { title: "Blog" })))) expect(tag).toMatch(/aria-hidden="true"/);
  });
});
