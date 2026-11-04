import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import { LEAK_PATTERN, createFake, form, seededOptions, POST_DRAFT, CAT_A, type Actor } from "../admin/support";
import { makePng } from "../storage/images";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()) }));

const { createClient } = await import("@/lib/supabase/server");
const posts = await import("@/lib/admin/posts/actions");
const categories = await import("@/lib/admin/categories/actions");

const WORDS = /supabase|postgres|stack|\bat \w|auth caído|xx000|select |relation/i;
const png = () => new File([new Uint8Array(makePng())], "imagen.png", { type: "image/png" });

type Call = [string, () => Promise<unknown>];
const calls: Call[] = [
  ["createPost", () => posts.createPost(null, form({ title: "Entrada", slug: "entrada-x", content: "x", intent: "save" }))],
  ["updatePost", () => posts.updatePost(null, form({ id: POST_DRAFT, title: "Entrada", slug: "entrada-x", content: "x", intent: "save" }))],
  ["publishPost", () => posts.publishPost(null, form({ id: POST_DRAFT }))],
  ["unpublishPost", () => posts.unpublishPost(null, form({ id: POST_DRAFT }))],
  ["deletePost", () => posts.deletePost(null, form({ id: POST_DRAFT }))],
  ["uploadPostImage", () => posts.uploadPostImage(null, form({ image: png(), alt: "Alt" }))],
  ["createCategory", () => categories.createCategory(null, form({ name: "Luna" }))],
  ["renameCategory", () => categories.renameCategory(null, form({ id: CAT_A, name: "Sol" }))],
  ["deleteCategory", () => categories.deleteCategory(null, form({ id: CAT_A }))],
];

async function outcome(run: () => Promise<unknown>) {
  try {
    return { value: await run(), error: null as unknown };
  } catch (error) {
    return { value: null, error };
  }
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto.supabase.co");
});

describe("fallo cerrado de las acciones del panel (A10)", () => {
  it.each<[string, Actor]>([
    ["el servicio de autenticación caído", "down"],
    ["sin sesión", "anon"],
    ["un usuario que no es admin", "user"],
  ])("con %s, ninguna acción escribe, sube ni borra nada y nada interno sale en la respuesta", async (_caso, actor) => {
    for (const [name, call] of calls) {
      const fake = createFake({ ...seededOptions(), as: actor });
      vi.mocked(createClient).mockResolvedValue(fake.client as never);
      const { value, error } = await outcome(call);

      const visible = JSON.stringify(value) + String((error as Error | null)?.message ?? "") + String((error as { digest?: string } | null)?.digest ?? "");
      expect(visible, name).not.toMatch(WORDS);
      expect(visible, name).not.toMatch(LEAK_PATTERN);
      expect(fake.writes, name).toEqual([]);
      expect(fake.storage.log, name).toEqual([]);
      // Nunca se concede: o lanza (denegado/redirección) o devuelve un fallo; jamás un éxito.
      expect(value !== null && typeof value === "object" && "ok" in value && (value as { ok: unknown }).ok === true, name).toBe(false);
    }
  });

  it("si createClient lanza (configuración ausente o red caída), tampoco se concede ni se filtra el motivo", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("Failed to fetch https://x.supabase.co hunter2"));
    for (const [name, call] of calls) {
      const { value, error } = await outcome(call);
      const visible = JSON.stringify(value) + String((error as Error | null)?.message ?? "");
      expect(visible, name).not.toMatch(/hunter2|supabase|Failed to fetch/i);
      expect(value, name).toBeNull();
    }
  });
});

describe("la página de error no revela nada (A10)", () => {
  it("no muestra el mensaje, la traza ni el digest del error", () => {
    const hostile = Object.assign(new Error("SELECT * FROM posts; contraseña=hunter2 at Object.<anonymous> (/srv/app/x.ts:1:1)"), { digest: "digest-secreto-123" });
    const html = renderToStaticMarkup(createElement(ErrorPage, { error: hostile, reset: () => undefined }));
    for (const leak of ["SELECT", "hunter2", "Object.<anonymous>", "/srv/app", "digest-secreto", "contraseña"]) expect(html).not.toContain(leak);
    expect(html).toContain("Algo ha fallado");
  });
});
