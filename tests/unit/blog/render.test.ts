import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";
import { PostArticle } from "@/components/post-article";
import { PostCard } from "@/components/post-card";
import { pageTitle, postMetadata } from "@/lib/blog/metadata";
import { cardFixture, detailFixture, ORIGIN } from "./support";

const card = (post = cardFixture(), headingLevel?: 2 | 3) => renderToStaticMarkup(createElement(PostCard, { post, headingLevel }));
const article = (post = detailFixture()) => renderToStaticMarkup(createElement(PostArticle, { post, imageOrigin: ORIGIN }));

const PAYLOADS = ["<script>alert(1)</script>", '<img src=x onerror="alert(1)">', '"><svg onload=alert(1)>', "javascript:alert(1)", "<iframe src=//evil.test></iframe>"];
const inert = (html: string) => {
  expect(html).not.toMatch(/<script|<iframe|<svg[^>]*onload|<img[^>]*onerror/i);
  expect(html).not.toMatch(/\sonerror\s*=|\sonload\s*=/i);
};

describe("PostCard", () => {
  it("muestra título enlazado a la entrada, categorías enlazadas, fecha, tiempo de lectura e imagen decorativa", () => {
    const html = card();
    expect(html).toMatch(/<h2[^>]*>\s*<a[^>]*href="\/blog\/mi-entrada"[^>]*>Mi entrada<\/a>\s*<\/h2>/);
    expect(html).toMatch(/<a[^>]*href="\/categorias\/astrologia"[^>]*>Astrología<\/a>/);
    expect(html).toContain("2 de noviembre de 2026");
    expect(html).toMatch(/<time[^>]*datetime="2026-11-02T10:00:00Z"/);
    expect(html).toContain("3 min de lectura");
    expect(html).toMatch(/<img[^>]*alt=""/);
  });

  it("sin portada no pinta ninguna imagen", () => {
    expect(card(cardFixture({ coverUrl: null }))).not.toMatch(/<img/);
  });

  it("sin categorías no pinta etiquetas de categoría", () => {
    expect(card(cardFixture({ categories: [] }))).not.toMatch(/\/categorias\//);
  });

  it("el nivel del título se puede ajustar", () => {
    expect(card(cardFixture(), 3)).toMatch(/<h3/);
    expect(card(cardFixture(), 3)).not.toMatch(/<h2/);
  });

  it.each(PAYLOADS)("el título y la categoría con el payload %j salen como texto", (payload) => {
    const html = card(cardFixture({ title: payload, categories: [{ name: payload, slug: "astrologia" }] }));
    inert(html);
    expect(html).toContain("&lt;");
  });

  it("un slug de la base de datos no puede salir de la ruta del blog", () => {
    const html = card(cardFixture({ slug: 'x"><script>alert(1)</script>' }));
    inert(html);
  });
});

describe("PostArticle", () => {
  it("tiene un único h1 con el título, la fecha, el tiempo de lectura, la portada y el contenido", () => {
    const html = article();
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Mi entrada<\/h1>/);
    expect(html).toContain("2 de noviembre de 2026");
    expect(html).toContain("3 min de lectura");
    expect(html).toMatch(/<article/);
    expect(html).toMatch(/<h2>Subtítulo<\/h2>/); // el contenido baja un nivel
    expect(html).toMatch(/<strong>negrita<\/strong>/);
    expect(html).toMatch(/<img[^>]*alt=""/);
  });

  it("enlaza a la calculadora de compatibilidad", () => {
    expect(article()).toMatch(/<a[^>]*href="\/compatibilidad"/);
  });

  it.each(PAYLOADS)("el payload %j en título, categoría y contenido sale inerte", (payload) => {
    const html = article(
      detailFixture({
        title: payload,
        categories: [{ name: payload, slug: "astrologia" }],
        content: `${payload}\n\n**${payload}**\n\n[x](${payload})\n\n![x](${payload})`,
      }),
    );
    inert(html);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/href="javascript:/i);
  });
});

describe("404 y error: mensajes únicos y genéricos", () => {
  it("la página 404 es una sola, con un h1 y sin ningún dato de la entrada", () => {
    const html = renderToStaticMarkup(createElement(NotFound));
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(/no encontrada/i);
    expect(renderToStaticMarkup(createElement(NotFound))).toBe(html);
  });

  it("la página de error no muestra el mensaje interno ni la traza (A10)", () => {
    const error = Object.assign(new Error("relation posts contraseña=secreto"), { digest: "abc123", stack: "at /srv/app/secreto.ts:1" });
    const html = renderToStaticMarkup(createElement(ErrorPage, { error, reset: () => undefined }));
    expect(html).not.toMatch(/secreto|relation|contraseña|\/srv|abc123|at /);
    expect(html).toMatch(/<button/);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });
});

describe("metadatos", () => {
  it("pageTitle añade el sufijo del sitio", () => {
    expect(pageTitle("Blog")).toBe("Blog | Akira Astrum");
  });

  it("postMetadata usa el título de la entrada y su descripción", () => {
    expect(postMetadata(detailFixture())).toMatchObject({ title: "Mi entrada | Akira Astrum", description: "Subtítulo Texto con negrita." });
  });

  it("el payload en el título queda como texto del título (Next lo escapa)", () => {
    const metadata = postMetadata(detailFixture({ title: "<script>alert(1)</script>" }));
    expect(metadata.title).toBe("<script>alert(1)</script> | Akira Astrum");
  });
});
