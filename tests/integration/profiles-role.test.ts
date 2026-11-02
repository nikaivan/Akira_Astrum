import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientFor, expectDenied, identityOf } from "./support/api";
import { seedContent, tryInsertProfile, withTempUser, type Seed } from "./support/service-role";

let seed: Seed;
beforeAll(async () => {
  seed = await seedContent("roles");
});
afterAll(async () => {
  await seed?.cleanup();
});

const ownProfile = async (role: "user" | "noProfile" | "admin") => {
  const { data, error } = await clientFor(role).from("profiles").select("id, role");
  expect(error).toBeNull();
  return data;
};

describe("un usuario no puede darse el rol de admin", () => {
  it("el usuario no cambia su propio rol", async () => {
    const { id } = identityOf("user");
    expectDenied(await clientFor("user").from("profiles").update({ role: "admin" }).eq("id", id).select());
    expect(await ownProfile("user")).toEqual([{ id, role: "user" }]);
  });

  it("el usuario sin perfil no se inserta uno propio con rol admin", async () => {
    const { id } = identityOf("noProfile");
    const result = await clientFor("noProfile")
      .from("profiles")
      .insert({ id, display_name: "Quiero ser admin", role: "admin" })
      .select();
    expectDenied(result);
    expect(await ownProfile("noProfile")).toEqual([]);

    const category = await clientFor("noProfile").from("categories").insert({ name: "x", slug: `${seed.prefix}-sin-perfil` }).select();
    expectDenied(category);
  });

  it("el usuario no borra su propio perfil", async () => {
    const { id } = identityOf("user");
    expectDenied(await clientFor("user").from("profiles").delete().eq("id", id).select());
    expect(await ownProfile("user")).toEqual([{ id, role: "user" }]);
  });
});

describe("ni siquiera el admin gestiona perfiles por la API", () => {
  it("no cambia el rol de otro usuario ni el suyo", async () => {
    const user = identityOf("user").id;
    const admin = identityOf("admin").id;
    expectDenied(await clientFor("admin").from("profiles").update({ role: "admin" }).eq("id", user).select());
    expectDenied(await clientFor("admin").from("profiles").update({ role: "user" }).eq("id", admin).select());
    expect(await ownProfile("user")).toEqual([{ id: user, role: "user" }]);
    expect(await ownProfile("admin")).toEqual([{ id: admin, role: "admin" }]);
  });

  it("no crea ni borra perfiles ajenos", async () => {
    const noProfile = identityOf("noProfile").id;
    const user = identityOf("user").id;
    const created = await clientFor("admin").from("profiles").insert({ id: noProfile, display_name: "x", role: "admin" }).select();
    expectDenied(created);
    expectDenied(await clientFor("admin").from("profiles").delete().eq("id", user).select());
    expect(await ownProfile("noProfile")).toEqual([]);
    expect(await ownProfile("user")).toEqual([{ id: user, role: "user" }]);
  });
});

describe("restricción del rol", () => {
  it("la base de datos rechaza un rol desconocido (CHECK)", async () => {
    await withTempUser("rol-desconocido", null, async (user) => {
      const error = await tryInsertProfile(user.id, "superuser");
      expect(error?.code).toBe("23514");
    });
  });
});
