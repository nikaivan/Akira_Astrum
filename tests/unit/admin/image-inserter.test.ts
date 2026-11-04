import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PostEditor } from "@/components/admin/post-editor";
import { CAT_A, POST_DRAFT } from "./support";

vi.mock("@/lib/admin/posts/actions", () => {
  const action = vi.fn();
  return { createPost: action, updatePost: action, publishPost: action, unpublishPost: action, deletePost: action, uploadPostImage: action };
});

const ORIGIN = "https://proyecto.supabase.co";
const render = (props: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(PostEditor, { categories: [{ id: CAT_A, name: "Fuego" }], imageOrigin: ORIGIN, ...props }));
const draft = { id: POST_DRAFT, title: "T", slug: "t", content: "c", status: "draft" as const, categoryIds: [] };
const tag = (html: string, pattern: RegExp) => html.match(pattern)?.[0] ?? "";
const idOf = (html: string, label: string) => html.match(new RegExp(`<label[^>]*for="([^"]+)"[^>]*>${label}</label>`))?.[1];

describe.each([
  ["entrada nueva", () => render()],
  ["entrada existente", () => render({ post: draft })],
])("editor (%s): insertar una imagen en el contenido", (_name, make) => {
  const html = make();

  it("tiene el campo de archivo con su etiqueta, solo JPEG, PNG y WebP, y SIN nombre (no viaja con el guardado)", () => {
    const id = idOf(html, "Imagen para insertar en el contenido");
    expect(id).toBeTruthy();
    const input = tag(html, new RegExp(`<input[^>]*id="${id}"[^>]*>`));
    expect(input).toContain('type="file"');
    expect(input).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(input).not.toMatch(/\sname=/);
  });

  it("tiene el texto alternativo con su etiqueta, obligatorio y SIN nombre", () => {
    const id = idOf(html, "Texto alternativo de la imagen");
    expect(id).toBeTruthy();
    const input = tag(html, new RegExp(`<input[^>]*id="${id}"[^>]*>`));
    expect(input).toContain('aria-required="true"');
    expect(input).not.toMatch(/\sname=/);
  });

  it("el botón «Insertar imagen» es de tipo button (no envía el formulario) y mide al menos 44 px", () => {
    const button = tag(html, /<button[^>]*>Insertar imagen<\/button>/);
    expect(button).toContain('type="button"');
    expect(button).not.toMatch(/\sdisabled(=|\s|>)/);
    expect(button).toMatch(/min-h-11|h-11/);
  });

  it("explica los formatos, el tamaño máximo y que el texto alternativo es obligatorio", () => {
    expect(html).toMatch(/JPEG, PNG o WebP, máximo 2 MB/);
    expect(html).toMatch(/obligatorio/i);
  });

  it("anuncia el resultado en una región viva (sin role=status: el formulario ya tiene el suyo) y los errores como alerta, sin mostrar nada al empezar", () => {
    expect(html).toMatch(/<div[^>]*aria-live="polite"[^>]*data-slot="image-status"/);
    expect(html.match(/role="status"/g)?.length ?? 0).toBe(1); // solo el aviso del formulario
    expect(html).not.toMatch(/role="alert"[^>]*data-slot="image-error"/);
  });

  it("el bloque queda antes del campo de contenido y no añade ningún otro campo con nombre al formulario", () => {
    expect(html.indexOf("Insertar imagen")).toBeGreaterThan(-1);
    expect(html.indexOf("Insertar imagen")).toBeLessThan(html.indexOf('id="post-content"'));
    const names = [...html.matchAll(/<(?:input|textarea|select)[^>]*\sname="([^"]+)"/g)].map((match) => match[1]);
    expect(names).not.toEqual(expect.arrayContaining(["image", "alt"]));
  });
});
