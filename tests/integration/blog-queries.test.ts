import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getCategoryWithPosts, getPublishedPost, listPublishedPosts } from "@/lib/blog/queries";
import { anonClient, clientFor, testUrl } from "./support/api";
import { seedBlog, XSS_TITLE, type BlogSeed } from "./support/service-role";

let seed: BlogSeed;
beforeAll(async () => {
  seed = await seedBlog("blog");
});
afterAll(async () => {
  await seed?.cleanup();
});

const origin = () => testUrl();
const ownSlugs = (cards: { slug: string }[]) => cards.map((card) => card.slug).filter((slug) => slug.startsWith(seed.prefix));
const slugOf = (name: keyof BlogSeed["posts"]) => (Reflect.get(seed.posts, name) as { slug: string }).slug;

async function allPublished(client = anonClient()) {
  const result = await listPublishedPosts(client, { limit: 50, origin: origin() });
  if (result.status !== "ok") throw new Error("Se esperaba una lista");
  return result.data;
}

describe("listPublishedPosts con la clave anónima (RLS real)", () => {
  it("devuelve las publicadas por fecha de publicación, de la más nueva a la más antigua", async () => {
    const slugs = ownSlugs(await allPublished());
    expect(slugs).toEqual([slugOf("newest"), slugOf("xss"), slugOf("middle"), slugOf("oldest"), slugOf("unpublishable")]);
  });

  it("no devuelve ningún borrador", async () => {
    const slugs = (await allPublished()).map((card) => card.slug);
    expect(slugs).not.toContain(seed.drafts.inMain.slug);
    expect(slugs).not.toContain(seed.drafts.inDraftsOnly.slug);
  });

  it("respeta el límite", async () => {
    const result = await listPublishedPosts(anonClient(), { limit: 2, origin: origin() });
    expect(result.status === "ok" && result.data.length).toBeLessThanOrEqual(2);
  });

  it("cada tarjeta lleva fecha, tiempo de lectura y sus categorías, y nunca el autor ni el contenido", async () => {
    const cards = (await allPublished()).filter((card) => card.slug.startsWith(seed.prefix));
    const byslug = (slug: string) => cards.find((card) => card.slug === slug);

    expect(byslug(slugOf("newest"))).toMatchObject({
      title: seed.titles.newest,
      categories: [{ name: `${seed.prefix} cat`, slug: `${seed.prefix}-cat` }],
      readingMinutes: 1,
    });
    expect(byslug(slugOf("newest"))?.dateLabel).toMatch(/^\d{1,2} de [a-záéíóú]+ de \d{4}$/);
    expect(byslug(slugOf("middle"))?.categories).toEqual([]);
    for (const card of cards) expect(JSON.stringify(card)).not.toMatch(/author_id|content_md|Contenido de/);
  });

  it("ninguna tarjeta publicada muestra la categoría que solo tiene borradores", async () => {
    for (const card of await allPublished()) {
      expect(card.categories.map((category) => category.slug)).not.toContain(seed.categories.draftsOnly.slug);
    }
  });

  it("la URL de la portada apunta al Storage público del proyecto de test", async () => {
    const cards = await allPublished();
    const newest = cards.find((card) => card.slug === slugOf("newest"));
    expect(newest?.coverUrl).toBe(`${origin()}/storage/v1/object/public/post-images/${seed.coverName}`);
    expect(cards.find((card) => card.slug === slugOf("middle"))?.coverUrl).toBeNull();
  });

  it("un título con HTML se devuelve tal cual: el escape es del render, no del almacenamiento", async () => {
    const xss = (await allPublished()).find((card) => card.slug === slugOf("xss"));
    expect(xss?.title).toBe(XSS_TITLE);
  });

  it("doble barrera: aunque se pase el cliente de un admin, solo salen las publicadas", async () => {
    const slugs = (await allPublished(clientFor("admin"))).map((card) => card.slug);
    expect(slugs).not.toContain(seed.drafts.inMain.slug);
    expect(slugs).not.toContain(seed.drafts.inDraftsOnly.slug);
    expect(ownSlugs(await allPublished(clientFor("admin")))).toHaveLength(5);
  });
});

describe("getPublishedPost", () => {
  it("lee una entrada publicada con su contenido, descripción y categorías", async () => {
    const result = await getPublishedPost(anonClient(), slugOf("newest"), { origin: origin() });
    expect(result).toEqual({
      status: "ok",
      data: expect.objectContaining({
        slug: slugOf("newest"),
        title: seed.titles.newest,
        content: "Contenido de **nueva**.",
        description: "Contenido de nueva.",
        categories: [{ name: `${seed.prefix} cat`, slug: `${seed.prefix}-cat` }],
      }),
    });
  });

  it("un borrador no se lee por slug: es idéntico a un slug inexistente", async () => {
    const draft = await getPublishedPost(anonClient(), seed.drafts.inMain.slug, { origin: origin() });
    const missing = await getPublishedPost(anonClient(), `${seed.prefix}-no-existe`, { origin: origin() });
    expect(draft).toStrictEqual({ status: "not-found" });
    expect(missing).toStrictEqual(draft);
  });

  it("doble barrera: ni siquiera con el cliente de un admin se lee un borrador", async () => {
    const result = await getPublishedPost(clientFor("admin"), seed.drafts.inMain.slug, { origin: origin() });
    expect(result).toStrictEqual({ status: "not-found" });
  });

  it.each(["../etc/passwd", "<script>alert(1)</script>", "A--B", "x".repeat(81)])("el slug raro %j da not-found", async (slug) => {
    expect(await getPublishedPost(anonClient(), slug, { origin: origin() })).toStrictEqual({ status: "not-found" });
  });
});

describe("getCategoryWithPosts", () => {
  it("muestra solo las entradas publicadas de la categoría, de la más nueva a la más antigua", async () => {
    const result = await getCategoryWithPosts(anonClient(), seed.categories.main.slug, { limit: 50, origin: origin() });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.category.slug).toBe(seed.categories.main.slug);
    expect(result.data.posts.map((post) => post.slug)).toEqual([slugOf("newest"), slugOf("xss"), slugOf("oldest"), slugOf("unpublishable")]);
    expect(result.data.posts.map((post) => post.slug)).not.toContain(seed.drafts.inMain.slug);
  });

  it("una categoría que solo tiene borradores existe y está vacía (200, no 404)", async () => {
    const result = await getCategoryWithPosts(anonClient(), seed.categories.draftsOnly.slug, { limit: 50, origin: origin() });
    expect(result).toEqual({ status: "ok", data: { category: expect.objectContaining({ slug: seed.categories.draftsOnly.slug }), posts: [] } });
  });

  it("doble barrera: con el cliente de un admin, la categoría de solo borradores sigue vacía", async () => {
    const result = await getCategoryWithPosts(clientFor("admin"), seed.categories.draftsOnly.slug, { limit: 50, origin: origin() });
    expect(result.status === "ok" && result.data.posts).toEqual([]);
  });

  it("una categoría inexistente es not-found", async () => {
    expect(await getCategoryWithPosts(anonClient(), `${seed.prefix}-nada`, { limit: 50, origin: origin() })).toStrictEqual({ status: "not-found" });
  });
});

describe("despublicar tiene efecto en la siguiente lectura (sin caché)", () => {
  it("la entrada desaparece de la lista, de su categoría y de la lectura por slug, y vuelve al republicarla", async () => {
    const admin = clientFor("admin");
    const id = seed.posts.unpublishable.id;
    const slug = slugOf("unpublishable");

    expect(ownSlugs(await allPublished())).toContain(slug);

    const unpublish = await admin.from("posts").update({ status: "draft", published_at: null }).eq("id", id).select("id");
    expect(unpublish.error).toBeNull();

    expect(ownSlugs(await allPublished())).not.toContain(slug);
    expect(await getPublishedPost(anonClient(), slug, { origin: origin() })).toStrictEqual({ status: "not-found" });
    const category = await getCategoryWithPosts(anonClient(), seed.categories.main.slug, { limit: 50, origin: origin() });
    expect(category.status === "ok" && category.data.posts.map((post) => post.slug)).not.toContain(slug);

    const republish = await admin.from("posts").update({ status: "published", published_at: new Date().toISOString() }).eq("id", id).select("id");
    expect(republish.error).toBeNull();
    expect(ownSlugs(await allPublished())).toContain(slug);
  });
});
