import { beforeEach, describe, expect, it, vi } from "vitest";
import * as messages from "@/lib/admin/messages";
import { UPLOAD_LIMIT } from "@/lib/storage/limiter";
import { makePng } from "../storage/images";
import { createFake, form, seededOptions } from "./support";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createClient } = await import("@/lib/supabase/server");
const { createPost, uploadPostImage } = await import("@/lib/admin/posts/actions");

const png = () => new File([new Uint8Array(makePng())], "imagen.png", { type: "image/png" });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto.supabase.co");
});

describe("el límite de subidas es único para portadas e imágenes del contenido", () => {
  it("las subidas de una y otra cuentan en el mismo cupo y la siguiente se bloquea sin tocar Storage", async () => {
    const fake = createFake(seededOptions());
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    // La mitad con portada (createPost termina en redirect) y la otra mitad con imágenes del contenido.
    for (let i = 0; i < UPLOAD_LIMIT; i += 1) {
      if (i % 2 === 0) {
        await createPost(null, form({ title: `Entrada ${i}`, slug: `entrada-${i}`, content: "x", intent: "save", coverAlt: "Alt", cover: png() })).catch(() => undefined);
      } else {
        expect(await uploadPostImage(null, form({ image: png(), alt: "Alt" }))).toMatchObject({ ok: true });
      }
    }
    const uploadsBefore = fake.storage.log.filter((entry) => entry.op === "upload").length;
    expect(uploadsBefore).toBe(UPLOAD_LIMIT);

    expect(await uploadPostImage(null, form({ image: png(), alt: "Alt" }))).toEqual({ ok: false, message: messages.UPLOAD_RATE_LIMIT });
    expect(fake.storage.log.filter((entry) => entry.op === "upload")).toHaveLength(uploadsBefore);
  });
});
