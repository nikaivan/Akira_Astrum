import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, clientFor, UNPRIVILEGED } from "./support/api";
import { ensureProfiles, removeStorageObjects } from "./support/service-role";

const BUCKET = "post-images";
const MIB = 1024 * 1024;
// PNG de 1×1 píxel.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const created: string[] = [];
const newName = (extension = "png") => {
  const name = `${randomUUID()}.${extension}`;
  created.push(name);
  return name;
};
const admin = () => clientFor("admin").storage.from(BUCKET);
const upload = (client: ReturnType<typeof clientFor>, name: string, body: Buffer, contentType: string, upsert = false) =>
  client.storage.from(BUCKET).upload(name, body, { contentType, upsert });
const publicUrl = (name: string) => `${anonClient().storage.from(BUCKET).getPublicUrl(name).data.publicUrl}?t=${randomUUID()}`;

let shared: string;
beforeAll(async () => {
  await ensureProfiles(); // sin perfil de admin, is_admin() es false y la subida se deniega
  shared = newName();
  const { error } = await upload(clientFor("admin"), shared, PNG, "image/png");
  expect(error).toBeNull();
});
afterAll(async () => {
  await removeStorageObjects(created);
});

describe("admin", () => {
  it("sube, lista, reemplaza y borra una imagen", async () => {
    const name = newName();
    const up = await upload(clientFor("admin"), name, PNG, "image/png");
    expect(up.error).toBeNull();

    const listed = await admin().list();
    expect(listed.error).toBeNull();
    expect(listed.data?.map((file) => file.name)).toContain(name);

    const replaced = await upload(clientFor("admin"), name, PNG, "image/png", true);
    expect(replaced.error).toBeNull();

    const removed = await admin().remove([name]);
    expect(removed.error).toBeNull();
    expect(removed.data).toHaveLength(1);
  });

  it("la imagen subida se ve por la URL pública sin sesión y deja de verse al borrarla", async () => {
    const name = newName();
    expect((await upload(clientFor("admin"), name, PNG, "image/png")).error).toBeNull();

    const visible = await fetch(publicUrl(name));
    expect(visible.status).toBe(200);
    expect(visible.headers.get("content-type")).toBe("image/png");

    expect((await admin().remove([name])).error).toBeNull();

    // Storage responde con HTTP 400 y un "404" en el cuerpo, no con un 404 HTTP.
    const gone = await fetch(publicUrl(name));
    expect(gone.ok).toBe(false);
    expect(gone.headers.get("content-type")).not.toBe("image/png");
    expect(await gone.text()).toMatch(/404|not.?found/i);
  });

  it.each([
    ["sin UUID", () => "portada.png"],
    ["en una carpeta", () => `carpeta/${randomUUID()}.png`],
    ["con una ruta relativa", () => `../${randomUUID()}.png`],
    ["con extensión SVG", () => `${randomUUID()}.svg`],
    ["con doble extensión", () => `${randomUUID()}.png.exe`],
  ])("rechaza un nombre %s", async (_caso, make) => {
    const name = make();
    created.push(name);
    const { error } = await upload(clientFor("admin"), name, PNG, "image/png");
    expect(error).not.toBeNull();
  });

  it.each(["image/svg+xml", "text/html", "application/octet-stream"])("rechaza el tipo %s", async (type) => {
    const { error } = await upload(clientFor("admin"), newName(), PNG, type);
    expect(error).not.toBeNull();
  });

  it("acepta 2 MiB exactos y rechaza 2 MiB + 1 byte", async () => {
    const exact = await upload(clientFor("admin"), newName(), Buffer.alloc(2 * MIB), "image/png");
    expect(exact.error).toBeNull();
    const over = await upload(clientFor("admin"), newName(), Buffer.alloc(2 * MIB + 1), "image/png");
    expect(over.error).not.toBeNull();
  });
});

describe.each(UNPRIVILEGED)("rol %s", (role) => {
  it("no sube una imagen", async () => {
    const name = newName();
    const { error } = await upload(clientFor(role), name, PNG, "image/png");
    expect(error).not.toBeNull();
    const listed = await admin().list();
    expect(listed.data?.map((file) => file.name)).not.toContain(name);
  });

  it("no reemplaza una imagen existente", async () => {
    const { error } = await upload(clientFor(role), shared, Buffer.alloc(10), "image/png", true);
    expect(error).not.toBeNull();
    const response = await fetch(publicUrl(shared));
    expect((await response.arrayBuffer()).byteLength).toBe(PNG.length);
  });

  it("no borra una imagen", async () => {
    await clientFor(role).storage.from(BUCKET).remove([shared]);
    expect((await fetch(publicUrl(shared))).status).toBe(200);
  });

  it("no puede listar el bucket", async () => {
    const { data } = await clientFor(role).storage.from(BUCKET).list();
    expect(data ?? []).toEqual([]);
  });

  it("sí ve la imagen por su URL pública", async () => {
    const response = await fetch(publicUrl(shared));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });
});
