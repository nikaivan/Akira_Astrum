import { beforeAll, describe, expect, it } from "vitest";
import { clientFor } from "./support/api";
import { catalogReport, type CatalogReport } from "./support/service-role";

let report: CatalogReport;
beforeAll(async () => {
  report = await catalogReport();
});

const APP_TABLES = ["categories", "post_categories", "posts", "profiles"];

// Políticas esperadas: [esquema, tabla, nombre, operación, roles]
const POLICIES: [string, string, string, string, string[]][] = [
  ["public", "categories", "categories_delete_admin", "DELETE", ["authenticated"]],
  ["public", "categories", "categories_insert_admin", "INSERT", ["authenticated"]],
  ["public", "categories", "categories_select", "SELECT", ["anon", "authenticated"]],
  ["public", "categories", "categories_update_admin", "UPDATE", ["authenticated"]],
  ["public", "post_categories", "post_categories_delete_admin", "DELETE", ["authenticated"]],
  ["public", "post_categories", "post_categories_insert_admin", "INSERT", ["authenticated"]],
  ["public", "post_categories", "post_categories_select", "SELECT", ["anon", "authenticated"]],
  ["public", "posts", "posts_delete_admin", "DELETE", ["authenticated"]],
  ["public", "posts", "posts_insert_admin", "INSERT", ["authenticated"]],
  ["public", "posts", "posts_select", "SELECT", ["anon", "authenticated"]],
  ["public", "posts", "posts_update_admin", "UPDATE", ["authenticated"]],
  ["public", "profiles", "profiles_select_own", "SELECT", ["authenticated"]],
  ["storage", "objects", "post_images_delete_admin", "DELETE", ["authenticated"]],
  ["storage", "objects", "post_images_insert_admin", "INSERT", ["authenticated"]],
  ["storage", "objects", "post_images_select_admin", "SELECT", ["authenticated"]],
  ["storage", "objects", "post_images_update_admin", "UPDATE", ["authenticated"]],
];

// Privilegios de tabla esperados: [tabla, rol, privilegios]
const TABLE_PRIVILEGES: [string, string, string[]][] = [
  ["categories", "anon", ["SELECT"]],
  ["categories", "authenticated", ["DELETE", "INSERT", "SELECT", "UPDATE"]],
  ["post_categories", "anon", ["SELECT"]],
  ["post_categories", "authenticated", ["DELETE", "INSERT", "SELECT"]],
  ["posts", "anon", ["SELECT"]],
  ["posts", "authenticated", ["DELETE", "INSERT", "SELECT"]],
  ["profiles", "anon", []],
  ["profiles", "authenticated", ["SELECT"]],
];

// Columnas actualizables: author_id y created_at nunca.
const UPDATE_COLUMNS: [string, string, string[]][] = [
  ["categories", "anon", []],
  ["categories", "authenticated", ["created_at", "id", "name", "slug"]],
  ["post_categories", "anon", []],
  ["post_categories", "authenticated", []],
  ["posts", "anon", []],
  ["posts", "authenticated", ["content_md", "cover_image_path", "published_at", "slug", "status", "title"]],
  ["profiles", "anon", []],
  ["profiles", "authenticated", []],
];

describe("RLS", () => {
  it("todas las tablas de public tienen RLS activado y son exactamente las cuatro esperadas", () => {
    const publicTables = report.tables.filter((table) => table.schema === "public");
    expect(publicTables.map((table) => table.name).sort()).toEqual(APP_TABLES);
    expect(publicTables.filter((table) => !table.rls)).toEqual([]);
  });

  it.each(["objects", "buckets"])("storage.%s tiene RLS activado", (name) => {
    const table = report.tables.find((item) => item.schema === "storage" && item.name === name);
    expect(table?.rls).toBe(true);
  });

  it("el conjunto de políticas es exactamente el documentado", () => {
    const actual = report.policies.map((policy) => [
      policy.schema,
      policy.table,
      policy.name,
      policy.command,
      [...policy.roles].sort(),
    ]);
    expect(actual).toEqual(POLICIES);
  });
});

describe("privilegios", () => {
  it.each(TABLE_PRIVILEGES)("%s para %s: solo %j", (table, grantee, expected) => {
    const found = report.table_privileges.find((item) => item.table === table && item.grantee === grantee);
    expect(found?.privileges).toEqual(expected);
  });

  it.each(UPDATE_COLUMNS)("columnas actualizables de %s para %s: %j", (table, grantee, expected) => {
    const found = report.update_columns.find((item) => item.table === table && item.grantee === grantee);
    expect(found?.columns).toEqual(expected);
  });
});

describe("funciones", () => {
  it("solo existen las dos funciones esperadas, en el esquema private", () => {
    const names = report.functions.map((fn) => `${fn.schema}.${fn.name}`).sort();
    expect(names).toEqual(["private.is_admin", "private.set_updated_at"]);
  });

  it("todas tienen el search_path fijo y vacío", () => {
    for (const fn of report.functions) expect(fn.config).toContain('search_path=""');
  });

  it("solo is_admin es SECURITY DEFINER", () => {
    const definers = report.functions.filter((fn) => fn.security_definer).map((fn) => fn.name);
    expect(definers).toEqual(["is_admin"]);
  });

  it("ninguna tiene EXECUTE para PUBLIC", () => {
    expect(report.functions.filter((fn) => fn.public_execute)).toEqual([]);
  });
});

describe("bucket post-images", () => {
  it("es público, de 2 MiB y solo admite JPEG, PNG y WebP", () => {
    expect(report.bucket).toEqual({
      id: "post-images",
      name: "post-images",
      public: true,
      file_size_limit: 2097152,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    });
  });
});

describe("la utilidad de test", () => {
  it.each(["anon", "admin"] as const)("%s no puede llamar a test_catalog_report()", async (role) => {
    const { data, error } = await clientFor(role).rpc("test_catalog_report");
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});
