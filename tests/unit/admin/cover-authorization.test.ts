import { beforeEach, describe, expect, it, vi } from "vitest";
import * as messages from "@/lib/admin/messages";
import { makePng } from "../storage/images";
import { createFake, form, POST_DRAFT, POST_PUBLISHED, draftPost, publishedPost, type Actor } from "./support";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createClient } = await import("@/lib/supabase/server");
const { revalidatePath } = await import("next/cache");
const { createPost, updatePost, deletePost } = await import("@/lib/admin/posts/actions");

type Action = (previous: unknown, formData: FormData) => Promise<unknown>;
const OLD_COVER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png";
const image = () => new File([new Uint8Array(makePng())], "portada.png", { type: "image/png" });

const CASES: Array<[string, Action, () => FormData]> = [
  ["createPost con portada", createPost as Action, () => form({ title: "Nueva", slug: "", content: "x", intent: "save", coverAlt: "Alt", cover: image() })],
  ["updatePost con portada nueva", updatePost as Action, () => form({ id: POST_DRAFT, title: "Borrador uno", slug: "borrador-uno", content: "x", intent: "save", coverAlt: "Alt", cover: image() })],
  ["updatePost quitando la portada", updatePost as Action, () => form({ id: POST_PUBLISHED, title: "Publicada uno", slug: "publicada-uno", content: "x", intent: "save", coverAlt: "Alt", removeCover: "on" })],
  ["deletePost de una entrada con portada", deletePost as Action, () => form({ id: POST_PUBLISHED, confirm: "eliminar" })],
];

const options = () => ({ posts: [draftPost(), publishedPost({ cover_image_path: OLD_COVER, cover_alt: "Alt" })], storageObjects: [OLD_COVER] });

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(revalidatePath).mockReset();
});

describe.each<[string, Actor]>([
  ["anónimo", "anon"],
  ["autenticado sin rol admin", "user"],
  ["con Auth caído", "down"],
])("A01: %s no puede subir, reemplazar ni borrar portadas llamando a la acción", (_label, actor) => {
  it.each(CASES)("%s es rechazada y Storage no se toca", async (_name, action, make) => {
    const fake = createFake({ ...options(), as: actor });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const outcome = await action(null, make()).then(
      () => null,
      (error: unknown) => error,
    );

    expect(outcome).not.toBeNull();
    expect(fake.storage.log).toEqual([]);
    expect(fake.storage.names).toEqual([OLD_COVER]);
    expect(fake.writes).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("contraste: el admin sí puede", () => {
  it("createPost con portada sube el archivo y redirige", async () => {
    const fake = createFake(options());
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const outcome = await createPost(null, CASES[0][2]()).catch((error: { digest?: string }) => error);
    expect(String((outcome as { digest?: string }).digest)).toMatch(/^NEXT_REDIRECT/);
    expect(fake.storage.log.filter((entry) => entry.op === "upload")).toHaveLength(1);
  });

  it("si el borrado de la imagen antigua falla, el aviso llega al formulario", async () => {
    const fake = createFake({ ...options(), storageFailures: [{ op: "remove" }] });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const state = await updatePost(
      null,
      form({ id: POST_PUBLISHED, title: "Publicada uno", slug: "publicada-uno", content: "x", intent: "save", coverAlt: "Alt nuevo", cover: image() }),
    );
    expect(state).toMatchObject({ ok: true, warning: messages.COVER_OLD_NOT_REMOVED });
  });

  it("un archivo no válido devuelve el error de campo del formulario y no sube nada", async () => {
    const fake = createFake(options());
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const state = await createPost(null, form({ title: "Nueva", slug: "", content: "x", intent: "save", coverAlt: "Alt", cover: new File(["<svg/>"], "x.png", { type: "image/png" }) }));
    expect(state).toMatchObject({ ok: false, fieldErrors: { cover: messages.COVER_INVALID_TYPE } });
    expect(fake.storage.log).toEqual([]);
  });
});
