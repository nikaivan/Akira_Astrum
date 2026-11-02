/**
 * ÚNICO archivo (junto con la guarda) que usa SUPABASE_TEST_SERVICE_ROLE_KEY.
 * Usos permitidos, solo contra el proyecto de test (ver ../README.md):
 *   1. crear y borrar usuarios de prueba;
 *   2. crear y borrar los perfiles, entradas, categorías y objetos de Storage temporales;
 *   3. leer los metadatos de test_catalog_report().
 * No se usa para comprobar estados: eso se hace con la sesión del admin de prueba.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { inject } from "vitest";
import { assertTestEnvironment } from "./environment";

export const RUN_PREFIX = "itest-";
const BUCKET = "post-images";
const PAGE_SIZE = 200;
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205", "PGRST204"]);
const OPTIONS = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

export type Identity = { id: string; accessToken: string };
export type Fixtures = {
  runId: string;
  users: { admin: Identity; user: Identity; noProfile: Identity };
};
type Row = { id: string; slug: string };
export type Seed = {
  prefix: string;
  adminId: string;
  userId: string;
  category: Row;
  spare: Row;
  published: Row;
  draft: Row;
  cleanup: () => Promise<void>;
};
export type TempUser = { id: string; email: string; password: string };

type Failure = { message: string; code?: string } | null;
type Query<T> = PromiseLike<{ data: T | null; error: Failure }>;

const serviceClient = (): SupabaseClient => {
  const { url, serviceRoleKey } = assertTestEnvironment(process.env);
  return createClient(url, serviceRoleKey, OPTIONS);
};

async function must<T>(query: Query<T>): Promise<T> {
  const { data, error } = await query;
  if (error || data === null) throw new Error(`Fallo preparando datos de prueba: ${error?.message ?? "sin datos"}`);
  return data;
}

async function run(query: PromiseLike<{ error: Failure }>, ignoreMissingTable = false): Promise<void> {
  const { error } = await query;
  if (error && !(ignoreMissingTable && MISSING_TABLE_CODES.has(error.code ?? ""))) {
    throw new Error(`Fallo preparando datos de prueba: ${error.message}`);
  }
}

export async function createTestUser(name: string, confirmed = true): Promise<TempUser> {
  const email = `${name}@example.test`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await serviceClient().auth.admin.createUser({ email, password, email_confirm: confirmed });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);
  return { id: data.user.id, email, password };
}

export async function deleteTestUser(id: string): Promise<void> {
  await serviceClient().auth.admin.deleteUser(id);
}

/** Crea un usuario temporal (con o sin perfil), ejecuta la prueba y lo borra siempre. */
export async function withTempUser<T>(
  label: string,
  profile: "admin" | "user" | null,
  test: (user: TempUser) => Promise<T>,
): Promise<T> {
  const user = await createTestUser(`${inject("fixtures").runId}-${label}`);
  try {
    if (profile) {
      await run(serviceClient().from("profiles").insert({ id: user.id, display_name: label, role: profile }));
    }
    return await test(user);
  } finally {
    await deleteTestUser(user.id);
  }
}

/** Crea un usuario cuyo correo NO está confirmado, ejecuta la prueba y lo borra siempre. */
export async function withUnconfirmedUser<T>(label: string, test: (user: TempUser) => Promise<T>): Promise<T> {
  const user = await createTestUser(`${inject("fixtures").runId}-${label}`, false);
  try {
    return await test(user);
  } finally {
    await deleteTestUser(user.id);
  }
}

export async function deleteProfile(id: string): Promise<void> {
  await run(serviceClient().from("profiles").delete().eq("id", id));
}

/** Intenta insertar un perfil con un rol arbitrario; devuelve el error de la base de datos. */
export async function tryInsertProfile(id: string, role: string): Promise<Failure> {
  const { error } = await serviceClient().from("profiles").insert({ id, display_name: "prueba", role });
  return error;
}

async function deleteUsersWithEmailPrefix(db: SupabaseClient, prefix: string): Promise<void> {
  const ids: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(`No se pudieron listar los usuarios de prueba: ${error.message}`);
    ids.push(...data.users.filter((user) => user.email?.startsWith(prefix)).map((user) => user.id));
    if (data.users.length < PAGE_SIZE) break;
  }
  for (const id of ids) await db.auth.admin.deleteUser(id);
}

/** Borra solo lo que lleva el prefijo (entradas antes que usuarios: author_id es RESTRICT). */
async function removeByPrefix(prefix: string): Promise<void> {
  const db = serviceClient();
  await run(db.from("posts").delete().like("slug", `${prefix}%`), true);
  await run(db.from("categories").delete().like("slug", `${prefix}%`), true);
  await deleteUsersWithEmailPrefix(db, prefix);
}

export const sweepLeftovers = () => removeByPrefix(RUN_PREFIX);
export const removeEverything = (runId: string) => removeByPrefix(runId);

export async function cleanupPrefix(prefix: string): Promise<void> {
  const db = serviceClient();
  await run(db.from("posts").delete().like("slug", `${prefix}%`), true);
  await run(db.from("categories").delete().like("slug", `${prefix}%`), true);
}

/** Crea los usuarios de prueba (sin tocar tablas) e inicia sesión una sola vez en cada uno. */
export async function createSessions(): Promise<Fixtures> {
  const { url, anonKey } = assertTestEnvironment(process.env);
  const runId = `${RUN_PREFIX}${randomBytes(4).toString("hex")}`;
  const anon = createClient(url, anonKey, OPTIONS);

  const signedIn = async (label: "admin" | "user" | "noProfile") => {
    const created = await createTestUser(`${runId}-${label}`);
    const { data, error } = await anon.auth.signInWithPassword({ email: created.email, password: created.password });
    if (error || !data.session) throw new Error(`No se pudo iniciar sesión con el usuario de prueba: ${error?.message}`);
    return { id: created.id, accessToken: data.session.access_token };
  };

  const [admin, user, noProfile] = await Promise.all([signedIn("admin"), signedIn("user"), signedIn("noProfile")]);
  return { runId, users: { admin, user, noProfile } };
}

/** Perfiles de los usuarios admin y user (el usuario noProfile no tiene perfil a propósito). */
export async function ensureProfiles(): Promise<void> {
  const { users } = inject("fixtures");
  await run(
    serviceClient()
      .from("profiles")
      .upsert([
        { id: users.admin.id, display_name: "Admin de prueba", role: "admin" },
        { id: users.user.id, display_name: "Usuario de prueba", role: "user" },
      ]),
  );
}

/** Dos categorías y una entrada publicada y otra borrador, todo con prefijo único. */
export async function seedContent(tag: string): Promise<Seed> {
  const { runId, users } = inject("fixtures");
  const db = serviceClient();
  const prefix = `${runId}-${tag}`;

  await ensureProfiles();
  const category = (slug: string) =>
    must<Row>(db.from("categories").insert({ name: `${prefix} ${slug}`, slug: `${prefix}-${slug}` }).select("id, slug").single());
  const post = (slug: string, status: "published" | "draft") =>
    must<Row>(
      db
        .from("posts")
        .insert({
          title: `${prefix} ${slug}`,
          slug: `${prefix}-${slug}`,
          author_id: users.admin.id,
          status,
          published_at: status === "published" ? new Date().toISOString() : null,
        })
        .select("id, slug")
        .single(),
    );

  const [main, spare] = [await category("cat"), await category("spare")];
  const [published, draft] = [await post("pub", "published"), await post("draft", "draft")];
  await run(
    db.from("post_categories").insert([
      { post_id: published.id, category_id: main.id },
      { post_id: draft.id, category_id: main.id },
    ]),
  );

  return {
    prefix,
    adminId: users.admin.id,
    userId: users.user.id,
    category: main,
    spare,
    published,
    draft,
    cleanup: () => cleanupPrefix(prefix),
  };
}

/** Informe de metadatos de la base de datos (solo lectura). */
export async function catalogReport(): Promise<CatalogReport> {
  return must<CatalogReport>(serviceClient().rpc("test_catalog_report"));
}

export async function removeStorageObjects(names: string[]): Promise<void> {
  if (names.length === 0) return;
  await serviceClient().storage.from(BUCKET).remove(names);
}

export type CatalogReport = {
  tables: { schema: string; name: string; rls: boolean }[];
  policies: { schema: string; table: string; name: string; command: string; roles: string[] }[];
  table_privileges: { table: string; grantee: string; privileges: string[] }[];
  update_columns: { table: string; grantee: string; columns: string[] }[];
  functions: { schema: string; name: string; security_definer: boolean; config: string[]; public_execute: boolean }[];
  bucket: {
    id: string;
    public: boolean;
    file_size_limit: number;
    allowed_mime_types: string[];
  } | null;
};
