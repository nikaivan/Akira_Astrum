import { describe, expect, it } from "vitest";
import { getCategoryWithPosts, getPublishedPost, listPublishedPosts } from "@/lib/blog/queries";
import { COVER_URL, fakeClient, ops, ORIGIN, postRow, words, type Call } from "./support";

const SECRET_ERROR = { message: "relation posts contraseña=secreto", code: "XX000" };
const WEIRD_SLUGS = [
  "",
  "../etc/passwd",
  "..%2F..%2Fetc%2Fpasswd",
  "%2e%2e",
  "<script>alert(1)</script>",
  "MAYUSCULAS",
  "con espacios",
  "a--b",
  "-empieza",
  "termina-",
  "a".repeat(81),
  "uno\u0000dos",
  "uno\ndos",
  "'; drop table posts; --",
  "ñandú",
];

const selectedColumns = (call: Call | undefined) => String(ops(call, "select")[0]?.args[0] ?? "");
const eqs = (call: Call | undefined) => ops(call, "eq").map((op) => op.args);

describe("listPublishedPosts", () => {
  it("consulta solo las publicadas, ordenadas por fecha de publicación (y por id a igualdad) y con límite", async () => {
    const { client, calls } = fakeClient({ posts: { data: [postRow()] } });
    await listPublishedPosts(client, { limit: 50, origin: ORIGIN });

    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("posts");
    expect(eqs(calls[0])).toContainEqual(["status", "published"]);
    expect(ops(calls[0], "order").map((op) => op.args)).toEqual([
      ["published_at", { ascending: false }],
      ["id", { ascending: true }],
    ]);
    expect(ops(calls[0], "limit")[0]?.args).toEqual([50]);
  });

  it("pide columnas explícitas: nunca *, ni el autor, ni el estado", async () => {
    const { client, calls } = fakeClient({ posts: { data: [] } });
    await listPublishedPosts(client, { limit: 10, origin: ORIGIN });
    const columns = selectedColumns(calls[0]);
    expect(columns).not.toContain("*");
    expect(columns).not.toMatch(/author_id|status|created_at|updated_at/);
    expect(columns).toMatch(/title/);
  });

  it.each([
    [1000, 50],
    [51, 50],
    [0, 1],
    [-5, 1],
    [Number.NaN, 50],
    [2.7, 2],
  ])("el límite %s se ajusta a %i", async (requested, applied) => {
    const { client, calls } = fakeClient({ posts: { data: [] } });
    await listPublishedPosts(client, { limit: requested, origin: ORIGIN });
    expect(ops(calls[0], "limit")[0]?.args).toEqual([applied]);
  });

  it("convierte cada fila en una tarjeta con portada, categorías, fecha y tiempo de lectura", async () => {
    const { client } = fakeClient({ posts: { data: [postRow()] } });
    const result = await listPublishedPosts(client, { limit: 50, origin: ORIGIN });
    expect(result).toEqual({
      status: "ok",
      data: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          slug: "mi-entrada",
          title: "Mi entrada",
          coverUrl: COVER_URL,
          coverAlt: "",
          categories: [{ name: "Astrología", slug: "astrologia" }],
          publishedAt: "2026-11-02T10:00:00+00:00",
          dateLabel: "2 de noviembre de 2026",
          readingMinutes: 2,
        },
      ],
    });
  });

  it("la tarjeta no lleva el contenido ni el autor", async () => {
    const { client } = fakeClient({ posts: { data: [postRow({ author_id: "x", status: "published" })] } });
    const result = await listPublishedPosts(client, { limit: 50, origin: ORIGIN });
    const card = result.status === "ok" ? result.data[0] : {};
    expect(Object.keys(card)).not.toEqual(expect.arrayContaining(["content", "content_md"]));
    expect(JSON.stringify(card)).not.toMatch(/author_id|content_md|palabra0/);
  });

  it("aplana las categorías, ignora las nulas y tolera entradas sin categoría ni portada", async () => {
    const rows = [
      postRow({ post_categories: [{ categories: { name: "A", slug: "a" } }, { categories: null }, { categories: { name: "B", slug: "b" } }] }),
      postRow({ id: "2", slug: "otra", post_categories: [], cover_image_path: null }),
    ];
    const { client } = fakeClient({ posts: { data: rows } });
    const result = await listPublishedPosts(client, { limit: 50, origin: ORIGIN });
    expect(result.status === "ok" && result.data[0].categories).toEqual([
      { name: "A", slug: "a" },
      { name: "B", slug: "b" },
    ]);
    expect(result.status === "ok" && result.data[1]).toMatchObject({ categories: [], coverUrl: null });
  });

  it("una portada con un nombre que no es el generado no da URL", async () => {
    const { client } = fakeClient({ posts: { data: [postRow({ cover_image_path: "../x.png" })] } });
    const result = await listPublishedPosts(client, { limit: 50, origin: ORIGIN });
    expect(result.status === "ok" && result.data[0].coverUrl).toBeNull();
  });

  it("sin origen de Storage no hay URL de portada", async () => {
    const { client } = fakeClient({ posts: { data: [postRow()] } });
    const result = await listPublishedPosts(client, { limit: 50, origin: undefined });
    expect(result.status === "ok" && result.data[0].coverUrl).toBeNull();
  });

  it("calcula el tiempo de lectura con el contenido", async () => {
    const { client } = fakeClient({ posts: { data: [postRow({ content_md: words(401) })] } });
    const result = await listPublishedPosts(client, { limit: 50, origin: ORIGIN });
    expect(result.status === "ok" && result.data[0].readingMinutes).toBe(3);
  });

  it("sin filas devuelve una lista vacía (no es un error)", async () => {
    const { client } = fakeClient({ posts: { data: [] } });
    expect(await listPublishedPosts(client, { limit: 50, origin: ORIGIN })).toEqual({ status: "ok", data: [] });
  });

  it.each([
    ["un error de la base de datos", { error: SECRET_ERROR }],
    ["una excepción", "throws" as const],
    ["una respuesta sin datos ni error", { data: null }],
    ["datos que no son una lista", { data: { id: 1 } }],
  ])("%s es un error sin detalles (A10)", async (_caso, outcome) => {
    const { client } = fakeClient({ posts: outcome });
    const result = await listPublishedPosts(client, { limit: 50, origin: ORIGIN });
    expect(result).toStrictEqual({ status: "error" });
    expect(JSON.stringify(result)).not.toMatch(/secreto|XX000|relation/);
  });
});

describe("getPublishedPost", () => {
  it.each(WEIRD_SLUGS)("el slug %j no es válido: not-found sin consultar la base de datos", async (slug) => {
    const { client, calls } = fakeClient({ posts: { data: postRow() } });
    expect(await getPublishedPost(client, slug, { origin: ORIGIN })).toStrictEqual({ status: "not-found" });
    expect(calls).toHaveLength(0);
  });

  it("busca por slug solo entre las publicadas", async () => {
    const { client, calls } = fakeClient({ posts: { data: postRow() } });
    await getPublishedPost(client, "mi-entrada", { origin: ORIGIN });
    expect(calls).toHaveLength(1);
    expect(eqs(calls[0])).toEqual(expect.arrayContaining([["slug", "mi-entrada"], ["status", "published"]]));
    expect(selectedColumns(calls[0])).not.toContain("*");
    expect(selectedColumns(calls[0])).not.toMatch(/author_id/);
  });

  it("devuelve la entrada con su contenido, descripción, categorías y portada", async () => {
    const { client } = fakeClient({ posts: { data: postRow({ content_md: "# Hola **mundo**" }) } });
    const result = await getPublishedPost(client, "mi-entrada", { origin: ORIGIN });
    expect(result).toEqual({
      status: "ok",
      data: expect.objectContaining({
        slug: "mi-entrada",
        title: "Mi entrada",
        content: "# Hola **mundo**",
        description: "Hola mundo",
        coverUrl: COVER_URL,
        categories: [{ name: "Astrología", slug: "astrologia" }],
        dateLabel: "2 de noviembre de 2026",
        readingMinutes: 1,
      }),
    });
  });

  it("una fila ausente (borrador, despublicada o inexistente) es not-found, igual en todos los casos", async () => {
    const { client } = fakeClient({ posts: { data: null } });
    expect(await getPublishedPost(client, "no-existe", { origin: ORIGIN })).toStrictEqual({ status: "not-found" });
  });

  it.each([
    ["un error de la base de datos", { error: SECRET_ERROR }],
    ["una excepción", "throws" as const],
  ])("%s es un error y no un not-found", async (_caso, outcome) => {
    const { client } = fakeClient({ posts: outcome });
    const result = await getPublishedPost(client, "mi-entrada", { origin: ORIGIN });
    expect(result).toStrictEqual({ status: "error" });
  });
});

describe("getCategoryWithPosts", () => {
  const category = { id: "cat-1", name: "Astrología", slug: "astrologia" };

  it.each(WEIRD_SLUGS)("el slug %j no es válido: not-found sin consultar la base de datos", async (slug) => {
    const { client, calls } = fakeClient({ categories: { data: category } });
    expect(await getCategoryWithPosts(client, slug, { limit: 50, origin: ORIGIN })).toStrictEqual({ status: "not-found" });
    expect(calls).toHaveLength(0);
  });

  it("una categoría inexistente es not-found", async () => {
    const { client } = fakeClient({ categories: { data: null } });
    expect(await getCategoryWithPosts(client, "no-existe", { limit: 50, origin: ORIGIN })).toStrictEqual({ status: "not-found" });
  });

  it("consulta la categoría, sus entradas y solo las publicadas, por fecha de publicación", async () => {
    const { client, calls } = fakeClient({
      categories: { data: category },
      post_categories: { data: [{ post_id: "p1" }, { post_id: "p2" }] },
      posts: { data: [postRow({ id: "p1" }), postRow({ id: "p2", slug: "otra" })] },
    });
    const result = await getCategoryWithPosts(client, "astrologia", { limit: 50, origin: ORIGIN });

    expect(calls.map((call) => call.table)).toEqual(["categories", "post_categories", "posts"]);
    expect(eqs(calls[0])).toContainEqual(["slug", "astrologia"]);
    expect(eqs(calls[1])).toContainEqual(["category_id", "cat-1"]);
    expect(ops(calls[2], "in")[0]?.args).toEqual(["id", ["p1", "p2"]]);
    expect(eqs(calls[2])).toContainEqual(["status", "published"]);
    expect(ops(calls[2], "order").map((op) => op.args)).toEqual([
      ["published_at", { ascending: false }],
      ["id", { ascending: true }],
    ]);
    expect(ops(calls[2], "limit")[0]?.args).toEqual([50]);
    expect(result.status === "ok" && result.data.category).toEqual({ name: "Astrología", slug: "astrologia" });
    expect(result.status === "ok" && result.data.posts.map((post) => post.slug)).toEqual(["mi-entrada", "otra"]);
  });

  it("una categoría sin entradas visibles devuelve una lista vacía, no un error ni un 404", async () => {
    const { client } = fakeClient({ categories: { data: category }, post_categories: { data: [] }, posts: { data: [] } });
    expect(await getCategoryWithPosts(client, "astrologia", { limit: 50, origin: ORIGIN })).toEqual({
      status: "ok",
      data: { category: { name: "Astrología", slug: "astrologia" }, posts: [] },
    });
  });

  it.each([
    ["la consulta de la categoría", { categories: { error: SECRET_ERROR } }],
    ["la consulta de la relación", { categories: { data: category }, post_categories: { error: SECRET_ERROR } }],
    ["la consulta de las entradas", { categories: { data: category }, post_categories: { data: [{ post_id: "p1" }] }, posts: { error: SECRET_ERROR } }],
    ["una excepción", { categories: "throws" as const }],
  ])("un fallo en %s es un error sin detalles", async (_caso, responses) => {
    const { client } = fakeClient(responses);
    const result = await getCategoryWithPosts(client, "astrologia", { limit: 50, origin: ORIGIN });
    expect(result).toStrictEqual({ status: "error" });
  });
});
