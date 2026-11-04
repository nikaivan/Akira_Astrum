import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoryLinks } from "@/components/category-links";
import { PageBanner } from "@/components/page-banner";
import { PostCard } from "@/components/post-card";
import { PostGrid } from "@/components/post-grid";
import type { PostCardData } from "@/lib/blog/queries";

/**
 * Los títulos y las categorías los escribe el admin: una palabra larguísima sin espacios no debe ensanchar la página en un móvil.
 * Aquí no hay maquetación, así que se comprueba que los elementos permiten partir la palabra (`overflow-wrap: anywhere`) y que
 * los elementos de la cuadrícula pueden encogerse (`min-w-0`); el desborde real lo comprueba el e2e en un navegador.
 */
const LONG = "Supercalifragilisticoespialidosoastrologicamenteincreíbletituloexcesivamentelargosinespacios";
const post = (overrides: Partial<PostCardData> = {}): PostCardData => ({
  id: "1",
  slug: "entrada-larga",
  title: LONG,
  coverUrl: null,
  coverAlt: "",
  categories: [{ name: "Categoriaconunnombreexcesivamentelargosinespaciosparaprobar", slug: "larga" }],
  publishedAt: "2026-11-04T10:00:00.000Z",
  dateLabel: "4 nov 2026",
  readingMinutes: 5,
  ...overrides,
});
const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
const WRAPS = /\[overflow-wrap:anywhere\]|break-words|wrap-anywhere/;
const classOf = (markup: string, tag: RegExp) => markup.match(tag)?.[1] ?? "";

describe("títulos largos en las tarjetas", () => {
  it.each([
    ["tarjeta normal", () => html(createElement(PostCard, { post: post() }))],
    ["tarjeta destacada", () => html(createElement(PostCard, { post: post(), variant: "featured" }))],
    ["tarjeta de nivel 3", () => html(createElement(PostCard, { post: post(), headingLevel: 3 }))],
  ])("%s: el título permite partir la palabra", (_name, make) => {
    const markup = make();
    expect(markup).toContain(LONG);
    expect(classOf(markup, /<h[23][^>]*class="([^"]*)"/)).toMatch(WRAPS);
  });

  it("la tarjeta puede encogerse dentro de su contenedor (min-w-0)", () => {
    expect(classOf(html(createElement(PostCard, { post: post() })), /<article[^>]*class="([^"]*)"/)).toMatch(/\bmin-w-0\b|\boverflow-hidden\b/);
  });
});

describe("cuadrícula de entradas", () => {
  const markup = html(createElement(PostGrid, { posts: [post(), post({ id: "2", slug: "otra", title: "Corto" })] }));

  it("cada elemento de la cuadrícula puede encogerse (un elemento de cuadrícula crece hasta su contenido mínimo si no)", () => {
    const items = [...markup.matchAll(/<li[^>]*class="([^"]*)"/g)].map((match) => match[1]);
    expect(items).toHaveLength(2);
    for (const item of items) expect(item).toMatch(/\bmin-w-0\b/);
  });

  it("el título largo sigue partiéndose dentro de la cuadrícula", () => {
    expect(classOf(markup, /<h2[^>]*class="([^"]*)"/)).toMatch(WRAPS);
  });
});

describe("categorías con nombres largos", () => {
  it("los enlaces permiten partir el nombre", () => {
    const markup = html(createElement(CategoryLinks, { categories: post().categories }));
    expect(markup).toContain("Categoriaconunnombre");
    expect(classOf(markup, /<a[^>]*class="([^"]*)"/)).toMatch(WRAPS);
  });
});

describe("banda de título (guarda de regresión)", () => {
  it("el h1 de una banda ya permite partir palabras largas", () => {
    expect(classOf(html(createElement(PageBanner, { title: LONG })), /<h1[^>]*class="([^"]*)"/)).toMatch(WRAPS);
  });
});
