import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { claimsOf, clientFor, exists, expectDenied, signedInClient } from "./support/api";
import { cleanupPrefix, deleteProfile, seedContent, withTempUser, type Seed } from "./support/service-role";

let seed: Seed;
beforeAll(async () => {
  seed = await seedContent("failclosed");
});
afterAll(async () => {
  await seed?.cleanup();
  await cleanupPrefix(`${seed?.prefix}-tmp`);
});

const category = (label: string) => ({ name: `Categoría ${label}`, slug: `${seed.prefix}-tmp-${label}` });

describe("si no se puede determinar el rol, se deniega", () => {
  it("un usuario sin perfil no lee borradores ni escribe", async () => {
    const draft = await clientFor("noProfile").from("posts").select("id").eq("id", seed.draft.id);
    expect(draft.data).toEqual([]);
    expectDenied(await clientFor("noProfile").from("categories").insert(category("sin-perfil")).select());
    expect(await exists("categories", "slug", category("sin-perfil").slug)).toBe(false);
  });

  it("el rol se consulta en cada petición: sin perfil, la misma sesión deja de ser admin", async () => {
    await withTempUser("sin-perfil-despues", "admin", async (user) => {
      const client = await signedInClient(user.email, user.password);

      const before = await client.from("categories").insert(category("antes")).select();
      expect(before.error).toBeNull();

      await deleteProfile(user.id); // el token sigue siendo válido, pero ya no hay perfil

      expectDenied(await client.from("categories").insert(category("despues")).select());
      expect(await exists("categories", "slug", category("despues").slug)).toBe(false);
    });
  });

  it("no se confía en user_metadata: ponerse role=admin en el token no concede nada", async () => {
    await withTempUser("metadata", "user", async (user) => {
      const client = await signedInClient(user.email, user.password);

      const updated = await client.auth.updateUser({ data: { role: "admin" } });
      expect(updated.error).toBeNull();
      const refreshed = await client.auth.refreshSession();
      expect(refreshed.error).toBeNull();

      const token = refreshed.data.session?.access_token ?? "";
      expect((claimsOf(token).user_metadata as { role?: string }).role).toBe("admin"); // el ataque es real

      expectDenied(await client.from("categories").insert(category("metadata")).select());
      expectDenied(
        await client.from("posts").update({ title: "Editada con metadata" }).eq("id", seed.published.id).select(),
      );
      expect(await exists("categories", "slug", category("metadata").slug)).toBe(false);
    });
  });
});
