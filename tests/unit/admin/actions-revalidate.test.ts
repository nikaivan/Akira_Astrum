import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_NAMES, createFake, form, seededOptions, VALID_FORMS } from "./support";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createClient } = await import("@/lib/supabase/server");
const { revalidatePath } = await import("next/cache");
const postActions = await import("@/lib/admin/posts/actions");
const categoryActions = await import("@/lib/admin/categories/actions");

type Action = (previous: unknown, formData: FormData) => Promise<unknown>;
const ACTIONS = { ...postActions, ...categoryActions } as unknown as Record<string, Action>;

// El blog público es dinámico y no se guarda en caché (ADR 0014): estas llamadas refrescan también la caché
// del enrutador del cliente, para que una entrada despublicada o eliminada deje de verse sin demora.
const EXPECTED = [["/"], ["/blog"], ["/blog/[slug]", "page"], ["/categorias/[slug]", "page"], ["/admin", "layout"]];

async function call(name: string, data: FormData) {
  const fake = createFake(seededOptions());
  vi.mocked(createClient).mockResolvedValue(fake.client as never);
  // Algunas acciones terminan con redirect(), que en Next lanza una excepción interna.
  await ACTIONS[name](null, data).catch((error: { digest?: string }) => {
    if (!String(error?.digest).startsWith("NEXT_REDIRECT")) throw error;
  });
  return fake;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(revalidatePath).mockReset();
});

describe("invalidación de la caché pública tras cada mutación", () => {
  it.each(ACTION_NAMES)("%s invalida las rutas públicas y el panel", async (name) => {
    await call(name, VALID_FORMS[name]());
    expect(vi.mocked(revalidatePath).mock.calls).toEqual(expect.arrayContaining(EXPECTED));
  });
});

describe("sin cambios no hay invalidación", () => {
  const INVALID: Record<string, FormData> = {
    createPost: form({ title: "", slug: "", content: "", intent: "save" }),
    updatePost: form({ id: "no-uuid", title: "x", slug: "", content: "", intent: "save" }),
    publishPost: form({ id: "no-uuid" }),
    unpublishPost: form({ id: "no-uuid" }),
    deletePost: form({ id: "55555555-5555-4555-8555-555555555555" }),
    createCategory: form({ name: "" }),
    renameCategory: form({ id: "no-uuid", name: "x" }),
    deleteCategory: form({ id: "11111111-1111-4111-8111-111111111111" }),
  };

  it.each(ACTION_NAMES)("%s con datos inválidos no escribe ni invalida", async (name) => {
    const fake = await call(name, INVALID[name]);
    expect(fake.writes).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("publicar algo ya publicado (doble clic) no invalida", async () => {
    await call("publishPost", form({ id: "55555555-5555-4555-8555-555555555555" }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("las acciones devuelven un estado utilizable por la interfaz", () => {
  it("un error de validación llega como { ok: false, message, fieldErrors }", async () => {
    const fake = createFake(seededOptions());
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const state = await ACTIONS.createPost(null, form({ title: "", slug: "", content: "", intent: "save" }));
    expect(state).toMatchObject({ ok: false, message: expect.any(String), fieldErrors: { title: expect.any(String) } });
  });

  it("guardar una entrada existente devuelve { ok: true, message } sin redirigir", async () => {
    const fake = createFake(seededOptions());
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const state = await ACTIONS.updatePost(null, VALID_FORMS.updatePost());
    expect(state).toMatchObject({ ok: true, message: "Cambios guardados." });
  });
});
