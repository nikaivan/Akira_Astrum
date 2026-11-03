import { describe, expect, it } from "vitest";
import * as messages from "@/lib/admin/messages";
import { performCreatePost, performUpdatePost } from "@/lib/admin/posts/service";
import {
  ADMIN_ID,
  CAT_A,
  CAT_B,
  CAT_MISSING,
  category,
  createFake,
  draftPost,
  LEAK_PATTERN,
  LEAKY_ERROR,
  OLD_DATE,
  POST_DRAFT,
  POST_MISSING,
  POST_PUBLISHED,
  publishedPost,
  type FakeOptions,
} from "./support";

const NOW = new Date("2026-11-04T10:00:00.000Z");
const CATEGORIES = [category(CAT_A, "Fuego", "fuego"), category(CAT_B, "Agua", "agua")];

const valid = (extra: Record<string, unknown> = {}) => ({ title: "Mi primera entrada", slug: "", content: "Hola **mundo**", categoryIds: [], intent: "save", ...extra });
const edit = (extra: Record<string, unknown> = {}) => valid({ id: POST_DRAFT, title: "Borrador uno", slug: "borrador-uno", content: "Texto del borrador", ...extra });

const create = (input: unknown, options: FakeOptions = {}) => {
  const fake = createFake({ categories: CATEGORIES, ...options });
  return { fake, run: performCreatePost({ supabase: fake.client, userId: ADMIN_ID, input, now: NOW }) };
};
const update = (input: unknown, options: FakeOptions = {}) => {
  const fake = createFake({ categories: CATEGORIES, posts: [draftPost(), publishedPost()], postCategories: [{ post_id: POST_DRAFT, category_id: CAT_A }], ...options });
  return { fake, run: performUpdatePost({ supabase: fake.client, userId: ADMIN_ID, input, now: NOW }) };
};

const INSERT_COLUMNS = ["author_id", "content_md", "published_at", "slug", "status", "title"];
const written = (fake: ReturnType<typeof createFake>, table: string, op: string) => fake.writes.filter((entry) => entry.table === table && entry.op === op);

describe("performCreatePost: creación", () => {
  it("crea un borrador cuyo autor es el admin de la sesión", async () => {
    const { fake, run } = create(valid());
    const result = await run;
    expect(result).toMatchObject({ ok: true });
    expect(fake.posts).toHaveLength(1);
    expect(fake.posts[0]).toMatchObject({ title: "Mi primera entrada", status: "draft", published_at: null, author_id: ADMIN_ID });
  });

  it("devuelve el id y el slug de la entrada creada", async () => {
    const { fake, run } = create(valid());
    const result = await run;
    expect(result).toMatchObject({ ok: true, id: fake.posts[0].id, slug: "mi-primera-entrada" });
  });

  it("solo envía columnas permitidas: nunca id, created_at, updated_at ni cover_image_path", async () => {
    const { fake, run } = create(valid());
    await run;
    const [insert] = written(fake, "posts", "insert");
    const keys = Object.keys(insert.values as object);
    expect(keys.every((key) => INSERT_COLUMNS.includes(key))).toBe(true);
    for (const forbidden of ["id", "created_at", "updated_at", "cover_image_path"]) expect(keys).not.toContain(forbidden);
  });

  it("el contenido se guarda idéntico, sin sanitizar ni recortar", async () => {
    const content = '\n  <script>alert(1)</script>\n<img src=x onerror="x()"> [a](javascript:x)\n\n';
    const { fake, run } = create(valid({ content }));
    await run;
    expect(fake.posts[0].content_md).toBe(content);
  });

  it("crear y publicar fija published_at con el reloj recibido", async () => {
    const { fake, run } = create(valid({ intent: "publish" }));
    await run;
    expect(fake.posts[0]).toMatchObject({ status: "published", published_at: NOW.toISOString() });
  });

  it("asigna las categorías elegidas", async () => {
    const { fake, run } = create(valid({ categoryIds: [CAT_A, CAT_B] }));
    await run;
    expect(fake.categoryIdsOf(fake.posts[0].id as string)).toEqual([CAT_A, CAT_B]);
  });
});

describe("performCreatePost: slug", () => {
  it("lo genera a partir del título con la función existente", async () => {
    const { fake, run } = create(valid({ title: "Ñandú: ¿Qué es el Sol?" }));
    await run;
    expect(fake.posts[0].slug).toBe("nandu-que-es-el-sol");
  });

  it("si ya existe, añade un sufijo numérico", async () => {
    const { fake, run } = create(valid({ title: "Mi entrada" }), { posts: [draftPost({ slug: "mi-entrada" }), draftPost({ id: crypto.randomUUID(), slug: "mi-entrada-2" })] });
    await run;
    expect(fake.posts.at(-1)?.slug).toBe("mi-entrada-3");
  });

  it("respeta un slug escrito a mano", async () => {
    const { fake, run } = create(valid({ slug: "luna-nueva" }));
    await run;
    expect(fake.posts[0].slug).toBe("luna-nueva");
  });

  it("un slug escrito a mano que ya existe da un error de campo claro y no crea nada", async () => {
    const { fake, run } = create(valid({ slug: "borrador-uno" }), { posts: [draftPost()] });
    expect(await run).toMatchObject({ ok: false, fieldErrors: { slug: messages.SLUG_TAKEN } });
    expect(fake.posts).toHaveLength(1);
  });

  it("un título imposible de convertir en slug pide escribirlo a mano, sin escribir", async () => {
    const { fake, run } = create(valid({ title: "🌙🌙🌙" }));
    expect(await run).toMatchObject({ ok: false, fieldErrors: { slug: messages.SLUG_FROM_TITLE_FAILED } });
    expect(fake.writes).toEqual([]);
  });
});

describe("performCreatePost: validación y mass assignment", () => {
  it("una entrada inválida no escribe nada y devuelve errores de campo", async () => {
    const { fake, run } = create(valid({ title: "   " }));
    expect(await run).toMatchObject({ ok: false, fieldErrors: { title: expect.any(String) } });
    expect(fake.writes).toEqual([]);
  });

  it.each(["author_id", "created_at", "updated_at", "published_at", "status", "cover_image_path"])("el campo %s rechaza todo el envío y no escribe", async (name) => {
    const { fake, run } = create(valid({ [name]: name === "author_id" ? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" : "x" }));
    expect(await run).toMatchObject({ ok: false, message: messages.INVALID_REQUEST });
    expect(fake.writes).toEqual([]);
  });

  it("una categoría que no existe se rechaza antes de escribir", async () => {
    const { fake, run } = create(valid({ categoryIds: [CAT_A, CAT_MISSING] }));
    expect(await run).toMatchObject({ ok: false, fieldErrors: { categoryIds: messages.CATEGORY_MISSING } });
    expect(fake.writes).toEqual([]);
  });
});

describe("performCreatePost: fallos a medias (A10)", () => {
  it("si falla asignar las categorías, se borra la entrada recién creada", async () => {
    const { fake, run } = create(valid({ categoryIds: [CAT_A] }), { failures: [{ table: "post_categories", op: "insert", error: LEAKY_ERROR }] });
    const result = await run;
    expect(result).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(fake.posts).toEqual([]);
    expect(fake.postCategories).toEqual([]);
    expect(written(fake, "posts", "delete")).toHaveLength(1);
  });

  it("si además falla la limpieza, devuelve igualmente el error genérico y no lanza", async () => {
    const { run } = create(valid({ categoryIds: [CAT_A] }), {
      failures: [
        { table: "post_categories", op: "insert", error: LEAKY_ERROR },
        { table: "posts", op: "delete", error: LEAKY_ERROR },
      ],
    });
    expect(await run).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
  });

  it("un fallo de la base de datos al insertar no filtra detalles internos", async () => {
    const { run } = create(valid(), { failures: [{ table: "posts", op: "insert", error: LEAKY_ERROR }] });
    const result = await run;
    expect(result).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });

  it("un cliente que lanza una excepción falla cerrado con el error genérico", async () => {
    const supabase = {
      from: () => {
        throw new Error(LEAKY_ERROR.message);
      },
    } as never;
    const result = await performCreatePost({ supabase, userId: ADMIN_ID, input: valid(), now: NOW });
    expect(result).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toMatch(LEAK_PATTERN);
  });
});

describe("performUpdatePost: edición", () => {
  it("solo actualiza título, slug y contenido", async () => {
    const { fake, run } = update(edit({ title: "Nuevo título", slug: "nuevo-slug", content: "Nuevo" }));
    expect(await run).toMatchObject({ ok: true });
    const [entry] = written(fake, "posts", "update");
    expect(Object.keys(entry.values as object).sort()).toEqual(["content_md", "slug", "title"]);
    expect(fake.postById(POST_DRAFT)).toMatchObject({ title: "Nuevo título", slug: "nuevo-slug", content_md: "Nuevo", author_id: ADMIN_ID, created_at: OLD_DATE });
  });

  it("guarda el contenido idéntico, con HTML hostil incluido", async () => {
    const content = '<script>x()</script>\n\n<iframe src="https://x.test"></iframe>  ';
    const { fake, run } = update(edit({ content }));
    await run;
    expect(fake.postById(POST_DRAFT)?.content_md).toBe(content);
  });

  it("nunca envía author_id, created_at ni updated_at", async () => {
    const { fake, run } = update(edit());
    await run;
    const keys = written(fake, "posts", "update").flatMap((entry) => Object.keys(entry.values as object));
    for (const forbidden of ["author_id", "created_at", "updated_at", "id"]) expect(keys).not.toContain(forbidden);
  });

  it("guardar una entrada publicada conserva su estado y su fecha de publicación", async () => {
    const { fake, run } = update(edit({ id: POST_PUBLISHED, title: "Otro título", slug: "publicada-uno" }));
    expect(await run).toMatchObject({ ok: true });
    expect(fake.postById(POST_PUBLISHED)).toMatchObject({ status: "published", published_at: OLD_DATE, title: "Otro título" });
  });

  it("una entrada que no existe da el mensaje claro y no escribe", async () => {
    const { fake, run } = update(edit({ id: POST_MISSING }));
    expect(await run).toMatchObject({ ok: false, message: messages.POST_NOT_FOUND });
    expect(fake.writes).toEqual([]);
  });

  it.each(["author_id", "created_at", "updated_at", "published_at", "status", "cover_image_path"])("el campo %s rechaza todo el envío y no escribe", async (name) => {
    const { fake, run } = update(edit({ [name]: "x" }));
    expect(await run).toMatchObject({ ok: false, message: messages.INVALID_REQUEST });
    expect(fake.writes).toEqual([]);
  });
});

describe("performUpdatePost: slug", () => {
  it("en un borrador se puede cambiar", async () => {
    const { fake, run } = update(edit({ slug: "otro-slug" }));
    expect(await run).toMatchObject({ ok: true, slug: "otro-slug" });
    expect(fake.postById(POST_DRAFT)?.slug).toBe("otro-slug");
  });

  it("en una entrada publicada no se puede cambiar (regla acordada)", async () => {
    const { fake, run } = update(edit({ id: POST_PUBLISHED, slug: "otra-direccion" }));
    expect(await run).toMatchObject({ ok: false, fieldErrors: { slug: messages.SLUG_LOCKED } });
    expect(fake.writes).toEqual([]);
    expect(fake.postById(POST_PUBLISHED)?.slug).toBe("publicada-uno");
  });

  it("en una publicada, repetir el mismo slug es válido", async () => {
    const { run } = update(edit({ id: POST_PUBLISHED, slug: "publicada-uno" }));
    expect(await run).toMatchObject({ ok: true });
  });

  it("un slug vacío al editar conserva el actual", async () => {
    const { fake, run } = update(edit({ slug: "" }));
    await run;
    expect(fake.postById(POST_DRAFT)?.slug).toBe("borrador-uno");
  });

  it("un slug que ya usa otra entrada da el mensaje de choque y no modifica nada", async () => {
    const { fake, run } = update(edit({ slug: "publicada-uno", title: "Cambiado" }));
    expect(await run).toMatchObject({ ok: false, fieldErrors: { slug: messages.SLUG_TAKEN } });
    expect(fake.postById(POST_DRAFT)).toMatchObject({ slug: "borrador-uno", title: "Borrador uno" });
  });
});

describe("performUpdatePost: categorías", () => {
  it("reemplaza el conjunto: primero inserta las nuevas y después borra las quitadas", async () => {
    const { fake, run } = update(edit({ categoryIds: [CAT_B] }));
    expect(await run).toMatchObject({ ok: true });
    expect(fake.categoryIdsOf(POST_DRAFT)).toEqual([CAT_B]);
    const relation = fake.writes.filter((entry) => entry.table === "post_categories").map((entry) => entry.op);
    expect(relation).toEqual(["insert", "delete"]);
  });

  it("si falla insertar las nuevas, no se borra ninguna de las existentes", async () => {
    const { fake, run } = update(edit({ categoryIds: [CAT_B] }), { failures: [{ table: "post_categories", op: "insert", error: LEAKY_ERROR }] });
    expect(await run).toMatchObject({ ok: false, message: messages.GENERIC_ERROR });
    expect(fake.categoryIdsOf(POST_DRAFT)).toEqual([CAT_A]);
    expect(written(fake, "post_categories", "delete")).toEqual([]);
  });

  it("el mismo conjunto no escribe en post_categories", async () => {
    const { fake, run } = update(edit({ categoryIds: [CAT_A] }));
    await run;
    expect(fake.writes.filter((entry) => entry.table === "post_categories")).toEqual([]);
  });

  it("quitar todas las categorías las borra", async () => {
    const { fake, run } = update(edit({ categoryIds: [] }));
    await run;
    expect(fake.categoryIdsOf(POST_DRAFT)).toEqual([]);
  });

  it("una categoría que no existe se rechaza antes de escribir", async () => {
    const { fake, run } = update(edit({ categoryIds: [CAT_MISSING] }));
    expect(await run).toMatchObject({ ok: false, fieldErrors: { categoryIds: messages.CATEGORY_MISSING } });
    expect(fake.writes).toEqual([]);
  });
});

describe("performUpdatePost: estado desde el editor (intent)", () => {
  it("publish en un borrador guarda los cambios y lo publica con el reloj recibido", async () => {
    const { fake, run } = update(edit({ intent: "publish", title: "Listo" }));
    expect(await run).toMatchObject({ ok: true });
    expect(fake.postById(POST_DRAFT)).toMatchObject({ title: "Listo", status: "published", published_at: NOW.toISOString() });
  });

  it("publish en una entrada ya publicada da el aviso y no cambia nada", async () => {
    const { fake, run } = update(edit({ id: POST_PUBLISHED, slug: "publicada-uno", title: "Cambio", intent: "publish" }));
    expect(await run).toMatchObject({ ok: false, message: messages.ALREADY_PUBLISHED });
    expect(fake.postById(POST_PUBLISHED)).toMatchObject({ title: "Publicada uno", published_at: OLD_DATE });
  });

  it("unpublish en una publicada la pasa a borrador y limpia published_at", async () => {
    const { fake, run } = update(edit({ id: POST_PUBLISHED, slug: "publicada-uno", intent: "unpublish" }));
    expect(await run).toMatchObject({ ok: true });
    expect(fake.postById(POST_PUBLISHED)).toMatchObject({ status: "draft", published_at: null });
  });

  it("unpublish en un borrador da el aviso", async () => {
    const { run } = update(edit({ intent: "unpublish" }));
    expect(await run).toMatchObject({ ok: false, message: messages.ALREADY_DRAFT });
  });

  it("si otra petición publica la entrada entre la lectura y la escritura, no se pisa su fecha", async () => {
    const OTHER = "2026-11-04T09:59:00.000Z";
    let flipped = false;
    const { fake, run } = update(edit({ intent: "publish" }), {
      beforeWrite: ({ table, op }) => {
        if (table !== "posts" || op !== "update" || flipped) return;
        flipped = true;
        Object.assign(fake.postById(POST_DRAFT) ?? {}, { status: "published", published_at: OTHER });
      },
    });
    expect(await run).toMatchObject({ ok: false, message: messages.ALREADY_PUBLISHED });
    expect(fake.postById(POST_DRAFT)?.published_at).toBe(OTHER);
  });
});
