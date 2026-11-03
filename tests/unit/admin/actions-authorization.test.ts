import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_NAMES, createFake, seededOptions, VALID_FORMS, type Actor } from "./support";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createClient } = await import("@/lib/supabase/server");
const { revalidatePath } = await import("next/cache");
const postActions = await import("@/lib/admin/posts/actions");
const categoryActions = await import("@/lib/admin/categories/actions");

type Action = (previous: unknown, formData: FormData) => Promise<unknown>;
const ACTIONS = { ...postActions, ...categoryActions } as unknown as Record<string, Action>;

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(revalidatePath).mockReset();
});

describe("las Server Actions del panel", () => {
  it("son exactamente las ocho acordadas (una acción nueva debe añadirse aquí y quedar protegida)", () => {
    expect(Object.keys(ACTIONS).sort()).toEqual(ACTION_NAMES);
    for (const action of Object.values(ACTIONS)) expect(typeof action).toBe("function");
  });
});

const SCENARIOS: Array<[string, Actor, (error: unknown) => void]> = [
  ["anónimo", "anon", (error) => expect(String((error as { digest?: string }).digest)).toMatch(/^NEXT_REDIRECT;.*\/login/)],
  ["autenticado sin rol admin", "user", (error) => expect(error).toEqual(new Error("Acceso denegado"))],
  ["con Auth caído", "down", (error) => expect(error).toEqual(new Error("Acceso denegado"))],
];

describe.each(SCENARIOS)("A01: %s llama directamente a cada acción", (_label, actor, expectRejection) => {
  it.each(ACTION_NAMES)("%s es rechazada y no modifica ni consulta nada", async (name) => {
    const fake = createFake({ ...seededOptions(), as: actor });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const outcome = await ACTIONS[name](null, VALID_FORMS[name]()).then(
      () => null,
      (error: unknown) => error,
    );

    expect(outcome).not.toBeNull();
    expectRejection(outcome);
    expect(fake.writes).toEqual([]);
    expect(fake.touchedData).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("A01: si no se puede ni crear el cliente de Supabase, también se deniega", () => {
  it.each(ACTION_NAMES)("%s falla cerrada", async (name) => {
    vi.mocked(createClient).mockImplementation(async () => {
      throw new Error("sin cookies");
    });
    const outcome = await ACTIONS[name](null, VALID_FORMS[name]()).then(
      () => null,
      (error: unknown) => error,
    );
    expect(outcome).toEqual(new Error("Acceso denegado"));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("contraste: el admin sí puede", () => {
  it.each(ACTION_NAMES)("%s se ejecuta con la sesión de un admin", async (name) => {
    const fake = createFake(seededOptions());
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const outcome = await ACTIONS[name](null, VALID_FORMS[name]()).then(
      (value) => value,
      (error: unknown) => error,
    );

    // Termina bien (con un estado) o con la redirección de Next; nunca con "Acceso denegado".
    const redirected = typeof (outcome as { digest?: string } | null)?.digest === "string" && String((outcome as { digest: string }).digest).startsWith("NEXT_REDIRECT");
    if (!redirected) expect(outcome).toMatchObject({ ok: true });
    expect(fake.writes.length).toBeGreaterThan(0);
  });
});
