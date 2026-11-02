import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientFor, exists, expectDenied, identityOf, UNPRIVILEGED } from "./support/api";
import { seedContent, type Seed } from "./support/service-role";

let seed: Seed;
beforeAll(async () => {
  seed = await seedContent("unpriv");
});
afterAll(async () => {
  await seed?.cleanup();
});

describe.each(UNPRIVILEGED)("rol %s", (role) => {
  const db = () => clientFor(role);
  const admin = () => clientFor("admin");

  it("lista solo las entradas publicadas", async () => {
    const { data, error } = await db().from("posts").select("id, status");
    expect(error).toBeNull();
    const ids = data?.map((post) => post.id);
    expect(ids).toContain(seed.published.id);
    expect(ids).not.toContain(seed.draft.id);
    expect(data?.every((post) => post.status === "published")).toBe(true);
  });

  it("no lee el borrador ni por id ni por slug", async () => {
    const byId = await db().from("posts").select("id").eq("id", seed.draft.id);
    const bySlug = await db().from("posts").select("id").eq("slug", seed.draft.slug);
    expect([byId.error, bySlug.error]).toEqual([null, null]);
    expect([byId.data, bySlug.data]).toEqual([[], []]);
  });

  it.each(["draft", "published"] as const)("no inserta una entrada %s", async (status) => {
    const slug = `${seed.prefix}-insert-${status}`;
    const result = await db()
      .from("posts")
      .insert({
        title: "No debería existir",
        slug,
        author_id: seed.adminId,
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
      })
      .select();
    expectDenied(result);
    expect(await exists("posts", "slug", slug)).toBe(false);
  });

  it("no edita una entrada publicada", async () => {
    const result = await db().from("posts").update({ title: "Editada sin permiso" }).eq("id", seed.published.id).select();
    expectDenied(result);
    const { data } = await admin().from("posts").select("title").eq("id", seed.published.id).single();
    expect(data?.title).toBe(`${seed.prefix} pub`);
  });

  it("no publica un borrador", async () => {
    const result = await db()
      .from("posts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", seed.draft.id)
      .select();
    expectDenied(result);
    const { data } = await admin().from("posts").select("status, published_at").eq("id", seed.draft.id).single();
    expect(data).toEqual({ status: "draft", published_at: null });
  });

  it("no borra ni la publicada ni el borrador", async () => {
    for (const id of [seed.published.id, seed.draft.id]) {
      expectDenied(await db().from("posts").delete().eq("id", id).select());
      expect(await exists("posts", "id", id)).toBe(true);
    }
  });

  it("lee todas las categorías", async () => {
    const { data, error } = await db().from("categories").select("id").in("id", [seed.category.id, seed.spare.id]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("no inserta, edita ni borra categorías", async () => {
    const slug = `${seed.prefix}-categoria-nueva`;
    expectDenied(await db().from("categories").insert({ name: "Nueva", slug }).select());
    expect(await exists("categories", "slug", slug)).toBe(false);

    expectDenied(await db().from("categories").update({ name: "Renombrada" }).eq("id", seed.category.id).select());
    const { data } = await admin().from("categories").select("name").eq("id", seed.category.id).single();
    expect(data?.name).toBe(`${seed.prefix} cat`);

    expectDenied(await db().from("categories").delete().eq("id", seed.spare.id).select());
    expect(await exists("categories", "id", seed.spare.id)).toBe(true);
  });

  it("solo ve las categorías asignadas a la entrada publicada", async () => {
    const { data, error } = await db()
      .from("post_categories")
      .select("post_id")
      .in("post_id", [seed.published.id, seed.draft.id]);
    expect(error).toBeNull();
    expect(data).toEqual([{ post_id: seed.published.id }]);
  });

  it("no asigna ni quita categorías", async () => {
    expectDenied(await db().from("post_categories").insert({ post_id: seed.published.id, category_id: seed.spare.id }).select());
    const link = { post_id: seed.published.id, category_id: seed.category.id };
    expectDenied(await db().from("post_categories").delete().match(link).select());
    const { data } = await admin().from("post_categories").select("post_id").match(link);
    expect(data).toHaveLength(1);
    const added = await admin().from("post_categories").select("post_id").match({ post_id: seed.published.id, category_id: seed.spare.id });
    expect(added.data).toEqual([]);
  });

  it("solo puede leer su propio perfil", async () => {
    const { data, error } = await db().from("profiles").select("id, role");
    if (role === "anon") {
      expect(error?.code).toBe("42501");
      return;
    }
    expect(error).toBeNull();
    expect(data).toEqual(role === "user" ? [{ id: identityOf("user").id, role: "user" }] : []);
  });
});
