import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as messages from "@/lib/admin/messages";
import { performUploadPostImage } from "@/lib/admin/posts/image-service";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { setSecuritySink } from "@/lib/security/log";
import { MAX_IMAGE_BYTES } from "@/lib/storage/image-validation";
import { makePng, SVG } from "../storage/images";
import { ADMIN_ID, createFake, form, seededOptions } from "../admin/support";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createClient } = await import("@/lib/supabase/server");
const { createPost } = await import("@/lib/admin/posts/actions");

const ORIGIN = "https://proyecto.supabase.co";
const MINUTE = 60_000;
const SECRET_NAME = "secreto-nombre-del-archivo.png";
const file = (bytes: Uint8Array, name = SECRET_NAME, type = "image/png") => new File([new Uint8Array(bytes)], name, { type });

let lines: string[] = [];
const events = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN);
  lines = [];
  setSecuritySink((line) => lines.push(line));
});
afterEach(() => {
  setSecuritySink(null);
  vi.unstubAllEnvs();
});

function upload(image: File, limiter = createRateLimiter({ limit: 20, windowMs: 10 * MINUTE })) {
  const fake = createFake();
  return { fake, run: performUploadPostImage({ supabase: fake.client, userId: ADMIN_ID, input: { image, alt: "Luna" }, limiter, storageOrigin: ORIGIN }) };
}

describe("subidas rechazadas: eventos de seguridad", () => {
  it("un archivo demasiado grande registra upload_rejected/too_large con el usuario", async () => {
    const { fake, run } = upload(file(new Uint8Array(MAX_IMAGE_BYTES + 1)));
    expect(await run).toMatchObject({ ok: false });
    expect(events()).toEqual([expect.objectContaining({ event: "upload_rejected", level: "warn", reason: "too_large", user: ADMIN_ID })]);
    expect(fake.storage.log).toEqual([]);
  });

  it.each([
    ["un SVG", () => file(SVG, "dibujo.svg", "image/svg+xml")],
    ["una firma falsa con extensión .png", () => file(new TextEncoder().encode("<html><script>alert(1)</script></html>"))],
  ])("%s registra upload_rejected/invalid_content", async (_caso, make) => {
    const { run } = upload(make());
    expect(await run).toMatchObject({ ok: false });
    expect(events()).toEqual([expect.objectContaining({ event: "upload_rejected", reason: "invalid_content", user: ADMIN_ID })]);
  });

  it("agotar el cupo registra upload_rejected/rate_limited", async () => {
    const limiter = createRateLimiter({ limit: 20, windowMs: 10 * MINUTE });
    for (let i = 0; i < 20; i++) limiter.recordFailure(ADMIN_ID);
    const { run } = upload(file(makePng()), limiter);
    expect(await run).toEqual({ ok: false, message: messages.UPLOAD_RATE_LIMIT });
    expect(events()).toEqual([expect.objectContaining({ event: "upload_rejected", reason: "rate_limited", user: ADMIN_ID })]);
  });

  it("una subida válida no registra nada", async () => {
    const { run } = upload(file(makePng()));
    expect(await run).toMatchObject({ ok: true });
    expect(events()).toEqual([]);
  });

  it("el nombre del archivo, su tipo declarado y la ruta no aparecen en ningún caso", async () => {
    await upload(file(new Uint8Array(MAX_IMAGE_BYTES + 1))).run;
    await upload(file(SVG, SECRET_NAME, "image/svg+xml")).run;
    expect(lines).toHaveLength(2);
    for (const leak of [SECRET_NAME, "secreto", "image/svg", "image/png", "<svg", ".png"]) expect(lines.join("\n")).not.toContain(leak);
  });

  it("la portada de createPost pasa por el mismo punto: contenido no válido registra upload_rejected", async () => {
    const fake = createFake(seededOptions());
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    await createPost(null, form({ title: "Entrada", slug: "entrada-x", content: "x", intent: "save", coverAlt: "Alt", cover: file(SVG, "dibujo.svg", "image/svg+xml") }));
    expect(events()).toEqual([expect.objectContaining({ event: "upload_rejected", reason: "invalid_content", user: ADMIN_ID })]);
  });

  it("el registro no cambia el resultado: con un sumidero que lanza, el rechazo es el mismo", async () => {
    const normal = await upload(file(new Uint8Array(MAX_IMAGE_BYTES + 1))).run;
    setSecuritySink(() => {
      throw new Error("el registro ha fallado");
    });
    expect(await upload(file(new Uint8Array(MAX_IMAGE_BYTES + 1))).run).toEqual(normal);
  });
});

describe("subidas: bloqueo y recuperación (A07)", () => {
  it("al agotar el cupo se bloquea y, pasada la ventana de 10 minutos, vuelve a admitir subidas", async () => {
    const clock = { now: 5_000_000 };
    const limiter = createRateLimiter({ limit: 20, windowMs: 10 * MINUTE, now: () => clock.now });
    for (let i = 0; i < 20; i++) expect(await upload(file(makePng()), limiter).run).toMatchObject({ ok: true });

    expect(await upload(file(makePng()), limiter).run).toEqual({ ok: false, message: messages.UPLOAD_RATE_LIMIT });
    clock.now += 10 * MINUTE - 1;
    expect(await upload(file(makePng()), limiter).run).toEqual({ ok: false, message: messages.UPLOAD_RATE_LIMIT });
    clock.now += 2;
    expect(await upload(file(makePng()), limiter).run).toMatchObject({ ok: true });
  });
});
