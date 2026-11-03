import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PostEditor } from "@/components/admin/post-editor";
import { CAT_A, POST_DRAFT, POST_PUBLISHED } from "./support";

vi.mock("@/lib/admin/posts/actions", () => {
  const action = vi.fn();
  return { createPost: action, updatePost: action, publishPost: action, unpublishPost: action, deletePost: action };
});

const ORIGIN = "https://proyecto.supabase.co";
const COVER_URL = `${ORIGIN}/storage/v1/object/public/post-images/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`;
const render = (props: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(PostEditor, { categories: [{ id: CAT_A, name: "Fuego" }], imageOrigin: ORIGIN, ...props }));
const draft = { id: POST_DRAFT, title: "T", slug: "t", content: "c", status: "draft" as const, categoryIds: [] };
const tag = (html: string, pattern: RegExp) => html.match(pattern)?.[0] ?? "";

describe("PostEditor: campo de portada (entrada nueva)", () => {
  const html = render();

  it("tiene el campo de archivo con su etiqueta y solo admite JPEG, PNG y WebP", () => {
    const id = html.match(/<label[^>]*for="([^"]+)"[^>]*>Imagen de portada<\/label>/)?.[1];
    expect(id).toBeTruthy();
    const input = tag(html, new RegExp(`<input[^>]*id="${id}"[^>]*>`));
    expect(input).toContain('type="file"');
    expect(input).toContain('name="cover"');
    expect(input).toContain('accept="image/jpeg,image/png,image/webp"');
  });

  it("explica los formatos y el tamaño máximo", () => {
    expect(html).toMatch(/JPEG, PNG o WebP/);
    expect(html).toMatch(/2 MB/);
  });

  it("tiene el texto alternativo con su etiqueta y marcado como obligatorio", () => {
    const id = html.match(/<label[^>]*for="([^"]+)"[^>]*>Texto alternativo de la portada<\/label>/)?.[1];
    expect(id).toBeTruthy();
    const input = tag(html, new RegExp(`<input[^>]*id="${id}"[^>]*>`));
    expect(input).toContain('name="coverAlt"');
    expect(input).toContain('aria-required="true"');
  });

  it("sin portada no hay vista previa ni botón de quitar", () => {
    expect(html).not.toMatch(/<img/);
    expect(html).not.toMatch(/Quitar portada/);
  });

  it("nunca hay un campo con la ruta de la imagen", () => {
    expect(html).not.toMatch(/name="(cover_image_path|cover_alt|coverPath|cover_url)"/);
  });
});

describe("PostEditor: entrada con portada", () => {
  const html = render({ post: { ...draft, cover: { url: COVER_URL, alt: "Luna llena" } } });

  it("muestra la portada actual como vista previa con su texto alternativo", () => {
    expect(tag(html, /<img[^>]*>/)).toContain(`src="${COVER_URL}"`);
    expect(tag(html, /<img[^>]*>/)).toContain('alt="Luna llena"');
  });

  it("el texto alternativo viene relleno y hay un botón de quitar (no envía el formulario)", () => {
    expect(tag(html, /<input[^>]*name="coverAlt"[^>]*>/)).toContain('value="Luna llena"');
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Quitar portada<\/button>/);
  });

  it("sigue sin haber un campo con la ruta", () => {
    expect(html).not.toMatch(/name="(cover_image_path|cover_alt|coverPath|cover_url)"/);
  });

  it("el botón de quitar y el campo de archivo siguen disponibles en una entrada publicada", () => {
    const published = render({ post: { ...draft, id: POST_PUBLISHED, status: "published", cover: { url: COVER_URL, alt: "Luna llena" } } });
    expect(published).toMatch(/Quitar portada/);
    expect(published).toMatch(/name="cover"/);
  });

  it("el alt de la vista previa se escapa", () => {
    const hostile = render({ post: { ...draft, cover: { url: COVER_URL, alt: '"><script>alert(1)</script>' } } });
    // React añade su propio <script> de reintento a los formularios con acción: se busca el payload, no cualquier script.
    expect(hostile).not.toMatch(/<script>alert\(1\)/);
    expect(hostile).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("PostEditor: errores accesibles de la portada", () => {
  const state = { ok: false as const, message: "Revisa los campos marcados.", fieldErrors: { cover: "La imagen debe ser JPEG, PNG o WebP.", coverAlt: "El texto alternativo de la portada es obligatorio." } };
  const html = render({ initialState: state });

  it.each([
    ["cover", "La imagen debe ser JPEG, PNG o WebP."],
    ["coverAlt", "El texto alternativo de la portada es obligatorio."],
  ])("el campo %s queda marcado como inválido y apunta a su mensaje", (field, text) => {
    const input = tag(html, new RegExp(`<input[^>]*name="${field}"[^>]*>`));
    expect(input).toContain('aria-invalid="true"');
    const describedBy = input.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeTruthy();
    expect(html).toMatch(new RegExp(`id="${describedBy}"[^>]*>[^<]*${text.replace(/[.()]/g, "\\$&")}`));
  });

  it("el resumen de errores del formulario repite los mensajes de la portada", () => {
    const summary = html.match(/role="alert"[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(summary).toContain("La imagen debe ser JPEG, PNG o WebP.");
    expect(summary).toContain("El texto alternativo de la portada es obligatorio.");
  });
});

describe("PostEditor: aviso tras guardar", () => {
  it("un aviso (por ejemplo, la imagen anterior no se pudo borrar) se muestra junto al mensaje de éxito", () => {
    const html = render({ post: draft, initialState: { ok: true, message: "Cambios guardados.", warning: "Los cambios se guardaron, pero no se pudo borrar la imagen anterior." } });
    expect(html).toMatch(/Cambios guardados\./);
    expect(html).toMatch(/no se pudo borrar la imagen anterior/);
  });
});
