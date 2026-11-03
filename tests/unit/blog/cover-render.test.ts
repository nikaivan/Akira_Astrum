import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PostArticle } from "@/components/post-article";
import { PostCard } from "@/components/post-card";
import { getPublishedPost, listPublishedPosts } from "@/lib/blog/queries";
import { cardFixture, detailFixture, fakeClient, ops, ORIGIN, postRow } from "./support";

const card = (post = cardFixture(), variant?: "default" | "featured") => renderToStaticMarkup(createElement(PostCard, { post, variant }));
const article = (post = detailFixture()) => renderToStaticMarkup(createElement(PostArticle, { post, imageOrigin: ORIGIN }));

const PLACEHOLDER = /data-slot="cover-placeholder"/;

describe("PostCard: texto alternativo de la portada", () => {
  it("la imagen lleva el texto alternativo de la entrada", () => {
    expect(card(cardFixture({ coverAlt: "Luna llena sobre el mar" }))).toMatch(/<img[^>]*alt="Luna llena sobre el mar"/);
  });

  it("el texto alternativo se escapa: nunca se interpreta como HTML", () => {
    const html = card(cardFixture({ coverAlt: '"><script>alert(1)</script>' }));
    expect(html).not.toMatch(/<script/i);
    expect(html).toMatch(/<img[^>]*alt="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;"/);
  });

  it.each([undefined, ""])("sin texto alternativo (%j) la imagen es decorativa: alt vacío", (coverAlt) => {
    expect(card(cardFixture({ coverAlt }))).toMatch(/<img[^>]*alt=""/);
  });

  it("la entrada destacada también lo lleva", () => {
    expect(card(cardFixture({ coverAlt: "Luna llena" }), "featured")).toMatch(/<img[^>]*alt="Luna llena"/);
  });

  it("la imagen es responsiva y se carga de forma diferida (next/image con sizes)", () => {
    const html = card(cardFixture({ coverAlt: "Luna" }));
    expect(html).toMatch(/<img[^>]*sizes="[^"]*\(min-width/);
    expect(html).toMatch(/<img[^>]*loading="lazy"/);
    expect(html).toMatch(/<img[^>]*srcSet="/i);
  });
});

describe("PostCard: sin portada", () => {
  it("muestra un marcador neutro, sin imagen y oculto a los lectores de pantalla", () => {
    const html = card(cardFixture({ coverUrl: null }));
    expect(html).not.toMatch(/<img/);
    expect(html).toMatch(PLACEHOLDER);
    expect(html).toMatch(/<[^>]*data-slot="cover-placeholder"[^>]*aria-hidden="true"|<[^>]*aria-hidden="true"[^>]*data-slot="cover-placeholder"/);
  });

  it("también en la entrada destacada", () => {
    expect(card(cardFixture({ coverUrl: null }), "featured")).toMatch(PLACEHOLDER);
  });

  it("con portada no aparece el marcador", () => {
    expect(card(cardFixture({ coverAlt: "Luna" }))).not.toMatch(PLACEHOLDER);
  });

  it("el marcador no añade texto que un lector de pantalla pueda leer", () => {
    const html = card(cardFixture({ coverUrl: null }));
    const placeholder = html.match(/<[^>]*data-slot="cover-placeholder"[^>]*>([\s\S]*?)<\/(?:div|span)>/)?.[1] ?? "";
    expect(placeholder.replace(/<[^>]*>/g, "").trim()).toBe("");
  });
});

describe("PostArticle: portada", () => {
  it("pinta la imagen con su texto alternativo", () => {
    expect(article(detailFixture({ coverAlt: "Luna llena sobre el mar" }))).toMatch(/<img[^>]*alt="Luna llena sobre el mar"/);
  });

  it("sin texto alternativo, alt vacío", () => {
    expect(article(detailFixture({ coverAlt: undefined }))).toMatch(/<img[^>]*alt=""/);
  });

  it("sin portada no hay imagen ni marcador: la cabecera de la entrada queda como estaba", () => {
    const html = article(detailFixture({ coverUrl: null }));
    expect(html).not.toMatch(/<img/);
    expect(html).not.toMatch(PLACEHOLDER);
  });
});

describe("lectura pública: texto alternativo", () => {
  const selectedColumns = (client: ReturnType<typeof fakeClient>) => String(ops(client.calls[0], "select")[0]?.args[0]);

  it("las consultas piden la columna cover_alt explícitamente, nunca *", async () => {
    const listing = fakeClient({ posts: { data: [postRow()] } });
    await listPublishedPosts(listing.client, { limit: 10, origin: ORIGIN });
    expect(selectedColumns(listing)).toMatch(/\bcover_alt\b/);
    expect(selectedColumns(listing)).not.toMatch(/\*/);

    const detail = fakeClient({ posts: { data: postRow() } });
    await getPublishedPost(detail.client, "mi-entrada", { origin: ORIGIN });
    expect(selectedColumns(detail)).toMatch(/\bcover_alt\b/);
  });

  it("devuelve el texto alternativo de la portada en las tarjetas y en la entrada", async () => {
    const listing = await listPublishedPosts(fakeClient({ posts: { data: [postRow({ cover_alt: "Luna llena" })] } }).client, { limit: 10, origin: ORIGIN });
    expect(listing.status === "ok" && listing.data[0].coverAlt).toBe("Luna llena");
    const detail = await getPublishedPost(fakeClient({ posts: { data: postRow({ cover_alt: "Luna llena" }) } }).client, "mi-entrada", { origin: ORIGIN });
    expect(detail.status === "ok" && detail.data.coverAlt).toBe("Luna llena");
  });

  it.each([null, undefined, 42, ""])("un cover_alt ausente o raro (%j) se convierte en cadena vacía", async (value) => {
    const listing = await listPublishedPosts(fakeClient({ posts: { data: [postRow({ cover_alt: value })] } }).client, { limit: 10, origin: ORIGIN });
    expect(listing.status === "ok" && listing.data[0].coverAlt).toBe("");
  });
});
