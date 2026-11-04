import type { SupabaseClient } from "@supabase/supabase-js";
import { makePng } from "../storage/images";

/**
 * Supabase falso en memoria para los tests unitarios del panel. No comprueba la forma de las llamadas,
 * sino su efecto, y reproduce las barreras de la base de datos real (esquema y migraciones):
 *   - slug único en posts y categories; claves foráneas y clave primaria de post_categories;
 *   - CHECK: published_at no es nulo si y solo si la entrada está publicada;
 *   - privilegios de columna: author_id, created_at e id no se pueden actualizar (42501);
 *   - RLS: solo el admin escribe (42501) y los demás solo leen;
 *   - ON DELETE CASCADE de post_categories; el trigger que renueva updated_at.
 */

export const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const CAT_A = "11111111-1111-4111-8111-111111111111";
export const CAT_B = "22222222-2222-4222-8222-222222222222";
export const CAT_MISSING = "33333333-3333-4333-8333-333333333333";
export const POST_DRAFT = "44444444-4444-4444-8444-444444444444";
export const POST_PUBLISHED = "55555555-5555-4555-8555-555555555555";
export const POST_MISSING = "66666666-6666-4666-8666-666666666666";
export const OLD_DATE = "2026-01-15T09:30:00.000Z";

export type Row = Record<string, unknown>;
type Table = "profiles" | "posts" | "categories" | "post_categories";
type Op = "select" | "insert" | "update" | "delete";
type Condition = { column: string; kind: "eq" | "in" | "like"; value: unknown };

export type DbError = { code?: string; message: string; details?: string; hint?: string };
export type Failure = { table: Table; op: Op; error: DbError; skip?: number };
export type WriteEntry = { table: Table; op: "insert" | "update" | "delete"; values?: unknown; conditions: Condition[] };
export type Actor = "admin" | "user" | "anon" | "down";

/** Fallo de Storage inyectado: `skip` deja pasar las primeras llamadas; `throws` simula una excepción de red. */
export type StorageFailure = { op: "upload" | "remove"; error?: DbError; skip?: number; throws?: boolean };
export type StorageEntry = { op: "upload" | "remove"; bucket: string; names: string[]; contentType?: string; upsert?: boolean; size?: number };

export type FakeOptions = {
  as?: Actor;
  posts?: Row[];
  categories?: Row[];
  postCategories?: Row[];
  failures?: Failure[];
  /** Objetos que ya existen en el bucket al empezar. */
  storageObjects?: string[];
  storageFailures?: StorageFailure[];
  /** Se ejecuta justo antes de cada escritura: permite simular a otra petición que cambia los datos. */
  beforeWrite?: (info: { table: Table; op: "insert" | "update" | "delete" }) => void;
};

const FORBIDDEN_UPDATE_COLUMNS = new Set(["id", "author_id", "created_at"]);
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const likeToRegExp = (pattern: string) =>
  new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("%", "[\\s\\S]*").replaceAll("_", ".")}$`);

export function post(overrides: Row = {}): Row {
  return {
    id: crypto.randomUUID(),
    title: "Entrada",
    slug: `entrada-${Math.random().toString(16).slice(2, 8)}`,
    content_md: "",
    cover_image_path: null,
    cover_alt: null,
    status: "draft",
    author_id: ADMIN_ID,
    created_at: OLD_DATE,
    updated_at: OLD_DATE,
    published_at: null,
    ...overrides,
  };
}

export const draftPost = (overrides: Row = {}) =>
  post({ id: POST_DRAFT, title: "Borrador uno", slug: "borrador-uno", content_md: "Texto del borrador", ...overrides });

export const publishedPost = (overrides: Row = {}) =>
  post({
    id: POST_PUBLISHED,
    title: "Publicada uno",
    slug: "publicada-uno",
    content_md: "Texto publicado",
    status: "published",
    published_at: OLD_DATE,
    ...overrides,
  });

export const category = (id: string, name: string, slug: string): Row => ({ id, name, slug, created_at: OLD_DATE });

export function createFake(options: FakeOptions = {}) {
  const actor = options.as ?? "admin";
  const userId = actor === "user" ? USER_ID : ADMIN_ID;
  const tables: Record<Table, Row[]> = {
    profiles: actor === "anon" || actor === "down" ? [] : [{ id: userId, role: actor === "admin" ? "admin" : "user" }],
    posts: structuredClone(options.posts ?? []),
    categories: structuredClone(options.categories ?? []),
    post_categories: structuredClone(options.postCategories ?? []),
  };
  const writes: WriteEntry[] = [];
  const touched = new Set<Table>();
  const pendingFailures = (options.failures ?? []).map((failure) => ({ ...failure, skip: failure.skip ?? 0 }));

  // Storage en memoria: reproduce las políticas del bucket (solo el admin sube y borra; el resto recibe un rechazo).
  const objects = new Map<string, { contentType: string; size: number }>((options.storageObjects ?? []).map((name) => [name, { contentType: "image/png", size: 1 }]));
  const storageLog: StorageEntry[] = [];
  const pendingStorageFailures = (options.storageFailures ?? []).map((failure) => ({ ...failure, skip: failure.skip ?? 0 }));
  const storageFailureFor = (op: "upload" | "remove") => {
    for (const failure of pendingStorageFailures) {
      if (failure.op !== op) continue;
      if (failure.skip > 0) {
        failure.skip -= 1;
        continue;
      }
      return failure;
    }
    return null;
  };

  const failureFor = (table: Table, op: Op): DbError | null => {
    for (const failure of pendingFailures) {
      if (failure.table !== table || failure.op !== op) continue;
      if (failure.skip > 0) {
        failure.skip -= 1;
        continue;
      }
      return failure.error;
    }
    return null;
  };

  const matches = (row: Row, conditions: Condition[]) =>
    conditions.every(({ column, kind, value }) => {
      const cell = row[column];
      if (kind === "eq") return cell === value;
      if (kind === "in") return (value as unknown[]).includes(cell);
      return typeof cell === "string" && likeToRegExp(String(value)).test(cell);
    });

  const violation = (table: Table, row: Row, others: Row[]): DbError | null => {
    if (table === "posts") {
      if ((row.status === "published") !== (row.published_at !== null && row.published_at !== undefined)) {
        return { code: "23514", message: "new row violates check constraint posts_published_at_matches_status" };
      }
      if (typeof row.slug !== "string" || row.slug.length > 80 || !SLUG_PATTERN.test(row.slug)) {
        return { code: "23514", message: "new row violates check constraint posts_slug_check" };
      }
    }
    if ((table === "posts" || table === "categories") && others.some((other) => other.slug === row.slug)) {
      return { code: "23505", message: `duplicate key value violates unique constraint "${table}_slug_key"` };
    }
    return null;
  };

  class Query implements PromiseLike<{ data: unknown; error: DbError | null }> {
    private op: Op = "select";
    private conditions: Condition[] = [];
    private values: Row | Row[] | null = null;
    private returning = false;
    private mode: "single" | "maybe" | null = null;

    constructor(private readonly table: Table) {
      touched.add(table);
    }

    select(_columns?: string) {
      if (this.op !== "select") this.returning = true;
      return this;
    }
    insert(values: Row | Row[]) {
      this.op = "insert";
      this.values = values;
      return this;
    }
    update(values: Row) {
      this.op = "update";
      this.values = values;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    eq(column: string, value: unknown) {
      this.conditions.push({ column, kind: "eq", value });
      return this;
    }
    in(column: string, value: unknown[]) {
      this.conditions.push({ column, kind: "in", value });
      return this;
    }
    like(column: string, value: string) {
      this.conditions.push({ column, kind: "like", value });
      return this;
    }
    order() {
      return this;
    }
    limit() {
      return this;
    }
    single() {
      this.mode = "single";
      return this;
    }
    maybeSingle() {
      this.mode = "maybe";
      return this;
    }

    then<A, B>(
      onfulfilled?: ((value: { data: unknown; error: DbError | null }) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }

    private shape(rows: Row[]): { data: unknown; error: DbError | null } {
      if (this.mode === "single") {
        return rows.length === 1
          ? { data: structuredClone(rows[0]), error: null }
          : { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } };
      }
      if (this.mode === "maybe") {
        return rows.length > 1
          ? { data: null, error: { code: "PGRST116", message: "multiple rows returned" } }
          : { data: rows.length === 1 ? structuredClone(rows[0]) : null, error: null };
      }
      return { data: structuredClone(rows), error: null };
    }

    private run(): { data: unknown; error: DbError | null } {
      const injected = failureFor(this.table, this.op);
      if (this.op !== "select") {
        writes.push({ table: this.table, op: this.op, values: structuredClone(this.values ?? undefined), conditions: [...this.conditions] });
        options.beforeWrite?.({ table: this.table, op: this.op });
        if (actor !== "admin") {
          return { data: null, error: { code: "42501", message: `new row violates row-level security policy for table "${this.table}"` } };
        }
      }
      if (injected) return { data: null, error: injected };

      const rows = tables[this.table];
      if (this.op === "select") return this.shape(rows.filter((row) => matches(row, this.conditions)));

      if (this.op === "insert") {
        const incoming = (Array.isArray(this.values) ? this.values : [this.values ?? {}]).map((value) => ({ ...value }));
        const staged: Row[] = [];
        for (const value of incoming) {
          const row: Row =
            this.table === "posts"
              ? { id: crypto.randomUUID(), content_md: "", cover_image_path: null, cover_alt: null, status: "draft", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), published_at: null, ...value }
              : this.table === "categories"
                ? { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...value }
                : { ...value };
          const failure = violation(this.table, row, [...rows, ...staged]);
          if (failure) return { data: null, error: failure };
          if (this.table === "post_categories") {
            const postOk = tables.posts.some((p) => p.id === row.post_id);
            const categoryOk = tables.categories.some((c) => c.id === row.category_id);
            if (!categoryOk || !postOk) return { data: null, error: { code: "23503", message: "insert or update on table violates foreign key constraint" } };
            if ([...rows, ...staged].some((other) => other.post_id === row.post_id && other.category_id === row.category_id)) {
              return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint post_categories_pkey" } };
            }
          }
          staged.push(row);
        }
        rows.push(...staged);
        return this.returning ? this.shape(staged) : { data: null, error: null };
      }

      if (this.op === "update") {
        const patch = this.values as Row;
        const forbidden = Object.keys(patch).find((column) => FORBIDDEN_UPDATE_COLUMNS.has(column));
        if (forbidden) return { data: null, error: { code: "42501", message: `permission denied for table ${this.table}` } };
        const targets = rows.filter((row) => matches(row, this.conditions));
        const updated: Row[] = [];
        for (const target of targets) {
          const next: Row = { ...target, ...patch };
          if (this.table === "posts") next.updated_at = new Date().toISOString();
          const failure = violation(this.table, next, rows.filter((row) => row !== target));
          if (failure) return { data: null, error: failure };
          updated.push(next);
        }
        targets.forEach((target, index) => Object.assign(target, updated[index]));
        return this.returning ? this.shape(targets) : { data: null, error: null };
      }

      const removed = rows.filter((row) => matches(row, this.conditions));
      tables[this.table] = rows.filter((row) => !removed.includes(row));
      if (this.table === "posts") {
        const ids = removed.map((row) => row.id);
        tables.post_categories = tables.post_categories.filter((row) => !ids.includes(row.post_id));
      }
      if (this.table === "categories") {
        const ids = removed.map((row) => row.id);
        tables.post_categories = tables.post_categories.filter((row) => !ids.includes(row.category_id));
      }
      return this.returning ? this.shape(removed) : { data: null, error: null };
    }
  }

  const client = {
    auth: {
      getUser: async () => {
        if (actor === "down") throw new Error("Auth caído");
        if (actor === "anon") return { data: { user: null }, error: Object.assign(new Error("Auth session missing!"), { name: "AuthSessionMissingError", status: 400 }) };
        return { data: { user: { id: userId } }, error: null };
      },
      getSession: () => {
        throw new Error("getSession no debe usarse");
      },
    },
    from: (table: Table) => new Query(table),
    storage: {
      from: (bucket: string) => ({
        upload: async (name: string, body: Uint8Array | Blob, uploadOptions?: { contentType?: string; upsert?: boolean }) => {
          const size = body instanceof Blob ? body.size : body.byteLength;
          storageLog.push({ op: "upload", bucket, names: [name], contentType: uploadOptions?.contentType, upsert: Boolean(uploadOptions?.upsert), size });
          const failure = storageFailureFor("upload");
          if (failure?.throws) throw new Error(LEAKY_ERROR.message);
          if (failure) return { data: null, error: failure.error ?? LEAKY_ERROR };
          if (actor !== "admin") return { data: null, error: { message: 'new row violates row-level security policy for table "objects"' } };
          if (objects.has(name) && !uploadOptions?.upsert) return { data: null, error: { message: "The resource already exists" } };
          objects.set(name, { contentType: uploadOptions?.contentType ?? "", size });
          return { data: { path: name }, error: null };
        },
        remove: async (names: string[]) => {
          storageLog.push({ op: "remove", bucket, names: [...names] });
          const failure = storageFailureFor("remove");
          if (failure?.throws) throw new Error(LEAKY_ERROR.message);
          if (failure) return { data: null, error: failure.error ?? LEAKY_ERROR };
          if (actor !== "admin") return { data: [], error: null }; // Storage no avisa: RLS simplemente no deja borrar nada
          return { data: names.filter((name) => objects.delete(name)).map((name) => ({ name })), error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;

  return {
    client,
    userId,
    get posts() {
      return tables.posts;
    },
    get categories() {
      return tables.categories;
    },
    get postCategories() {
      return tables.post_categories;
    },
    writes,
    storage: {
      log: storageLog,
      has: (name: string) => objects.has(name),
      get: (name: string) => objects.get(name),
      get names() {
        return [...objects.keys()].sort();
      },
    },
    /** Tablas de datos a las que se llegó a acceder (sin contar profiles, que lee la comprobación del rol). */
    get touchedData() {
      return [...touched].filter((table) => table !== "profiles");
    },
    postById: (id: string) => tables.posts.find((row) => row.id === id),
    categoryIdsOf: (postId: string) =>
      tables.post_categories
        .filter((row) => row.post_id === postId)
        .map((row) => row.category_id as string)
        .sort(),
  };
}

export type Fake = ReturnType<typeof createFake>;

/** FormData a partir de campos; un array repite la clave (casillas de categorías). */
export function form(fields: Record<string, string | string[] | Blob>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (Array.isArray(value)) value.forEach((item) => data.append(name, item));
    else data.append(name, value);
  }
  return data;
}

/** Texto señuelo: si aparece en una respuesta, se está filtrando un detalle interno. */
export const LEAKY_ERROR: DbError = {
  code: "XX000",
  message: 'connection to server at "10.0.0.5" failed: password=hunter2 SELECT * FROM public.posts',
  details: "Key (slug)=(secreto) relation public.posts",
};
export const LEAK_PATTERN = /hunter2|10\.0\.0\.5|SELECT|public\.posts|relation|XX000|secreto|password/i;

/** Datos con los que se prueban las acciones: dos entradas (borrador y publicada) y dos categorías. */
export const seededOptions = (): FakeOptions => ({
  categories: [category(CAT_A, "Fuego", "fuego"), category(CAT_B, "Agua", "agua")],
  posts: [draftPost(), publishedPost()],
  postCategories: [{ post_id: POST_DRAFT, category_id: CAT_A }],
});

/** Un formulario válido por cada Server Action del panel. */
export const VALID_FORMS: Record<string, () => FormData> = {
  createPost: () => form({ title: "Nueva entrada", slug: "", content: "Texto", intent: "save" }),
  updatePost: () => form({ id: POST_DRAFT, title: "Borrador uno", slug: "borrador-uno", content: "Cambiado", intent: "save" }),
  publishPost: () => form({ id: POST_DRAFT }),
  unpublishPost: () => form({ id: POST_PUBLISHED }),
  deletePost: () => form({ id: POST_DRAFT, confirm: "eliminar" }),
  createCategory: () => form({ name: "Tierra" }),
  renameCategory: () => form({ id: CAT_A, name: "Fuego vivo" }),
  deleteCategory: () => form({ id: CAT_A, confirm: "eliminar" }),
  uploadPostImage: () => form({ image: new File([new Uint8Array(makePng())], "imagen.png", { type: "image/png" }), alt: "Luna llena" }),
};
export const ACTION_NAMES = Object.keys(VALID_FORMS).sort();
