import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "@/components/markdown";
import { AdminNav } from "@/components/admin/admin-nav";
import { CategoryManager } from "@/components/admin/category-manager";
import { MarkdownPreview } from "@/components/admin/markdown-preview";
import { PostEditor } from "@/components/admin/post-editor";
import { PostFilters } from "@/components/admin/post-filters";
import { PostList } from "@/components/admin/post-list";
import { CAT_A, CAT_B, POST_DRAFT, POST_PUBLISHED } from "./support";

// Las acciones reales hablan con Supabase; aquí solo hace falta que existan para pasarlas a los formularios.
vi.mock("@/lib/admin/posts/actions", () => {
  const action = vi.fn();
  return { createPost: action, updatePost: action, publishPost: action, unpublishPost: action, deletePost: action };
});
vi.mock("@/lib/admin/categories/actions", () => {
  const action = vi.fn();
  return { createCategory: action, renameCategory: action, deleteCategory: action };
});

const ORIGIN = "https://proyecto.supabase.co";
const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
const CATEGORIES = [
  { id: CAT_A, name: "Fuego" },
  { id: CAT_B, name: "Agua" },
];

const draftRow = { id: POST_DRAFT, title: "Borrador <uno>", slug: "borrador-uno", status: "draft" as const, updatedAt: "2026-11-03T10:00:00.000Z", publishedAt: null, categories: [{ name: "Fuego", slug: "fuego" }] };
const publishedRow = { id: POST_PUBLISHED, title: "Publicada uno", slug: "publicada-uno", status: "published" as const, updatedAt: "2026-11-03T10:00:00.000Z", publishedAt: "2026-11-02T10:00:00.000Z", categories: [] };

describe("PostList", () => {
  const rendered = html(createElement(PostList, { posts: [draftRow, publishedRow] }));

  it("es una lista de tarjetas/filas, nunca una tabla (en móvil no hay scroll lateral)", () => {
    expect(rendered).not.toMatch(/<table|<thead|<tr[ >]/);
    expect((rendered.match(/<li[ >]/g) ?? []).length).toBe(2);
  });

  it("muestra el estado con texto (nunca solo con color) y escapa el título", () => {
    expect(rendered).toContain("Borrador");
    expect(rendered).toContain("Publicada");
    expect(rendered).toContain("Borrador &lt;uno&gt;");
    expect(rendered).not.toContain("<uno>");
  });

  it("cada fila enlaza a su edición y a su página pública solo si está publicada", () => {
    expect(rendered).toContain(`/admin/posts/${POST_DRAFT}/edit`);
    expect(rendered).toContain(`/admin/posts/${POST_PUBLISHED}/edit`);
    expect(rendered).toContain("/blog/publicada-uno");
    expect(rendered).not.toContain("/blog/borrador-uno");
  });

  it("ofrece solo la acción válida: Publicar en un borrador y Despublicar en una publicada", () => {
    const rows = rendered.split("<li").slice(1);
    expect(rows[0]).toMatch(/>Publicar</);
    expect(rows[0]).not.toMatch(/>Despublicar</);
    expect(rows[1]).toMatch(/>Despublicar</);
    expect(rows[1]).not.toMatch(/>Publicar</);
    for (const row of rows) expect(row).toMatch(/Eliminar/);
  });

  it("los botones de cada fila nombran la entrada, para que un lector de pantalla las distinga", () => {
    expect(rendered).toMatch(/aria-label="[^"]*Publicada uno[^"]*"/);
  });

  it("sin entradas explica que no hay ninguna", () => {
    expect(html(createElement(PostList, { posts: [] }))).toMatch(/No hay entradas/);
  });
});

describe("PostFilters", () => {
  const rendered = html(createElement(PostFilters, { status: "draft", category: "fuego", categories: [{ name: "Fuego", slug: "fuego" }, { name: "Agua", slug: "agua" }] }));

  it("es un formulario GET con las dos listas etiquetadas y el botón Filtrar", () => {
    expect(rendered).toMatch(/<form[^>]*method="get"/i);
    expect(rendered).toMatch(/<label[^>]*for="([^"]+)"[^>]*>Estado<\/label>/);
    expect(rendered).toMatch(/<label[^>]*for="([^"]+)"[^>]*>Categoría<\/label>/);
    expect(rendered).toContain("Filtrar");
  });

  it("marca como seleccionados los filtros actuales", () => {
    expect(rendered).toMatch(/<option[^>]*value="borrador"[^>]*selected|<option[^>]*selected[^>]*value="borrador"/);
    expect(rendered).toMatch(/<option[^>]*value="fuego"[^>]*selected|<option[^>]*selected[^>]*value="fuego"/);
  });
});

describe("PostEditor: formulario", () => {
  const blank = html(createElement(PostEditor, { categories: CATEGORIES, imageOrigin: ORIGIN }));

  it("cada campo tiene su etiqueta asociada", () => {
    for (const label of ["Título", "Dirección (slug)", "Contenido (Markdown)"]) {
      const match = blank.match(new RegExp(`<label[^>]*for="([^"]+)"[^>]*>${label.replace(/[()]/g, "\\$&")}`));
      expect(match, label).not.toBeNull();
      expect(blank).toContain(`id="${match?.[1]}"`);
    }
  });

  it("las categorías son casillas dentro de un fieldset con leyenda", () => {
    expect(blank).toMatch(/<fieldset[\s\S]*<legend[^>]*>Categorías<\/legend>/);
    expect((blank.match(/type="checkbox"[^>]*name="categoryIds"|name="categoryIds"[^>]*type="checkbox"/g) ?? []).length).toBe(2);
    expect(blank).toContain(`value="${CAT_A}"`);
  });

  it("no tiene ningún campo para lo que fija el servidor ni para la portada", () => {
    for (const forbidden of ["author_id", "created_at", "updated_at", "published_at", "status", "cover", "portada"]) {
      expect(blank).not.toMatch(new RegExp(`name="[^"]*${forbidden}`, "i"));
    }
  });

  it("una entrada nueva ofrece Guardar borrador y Publicar", () => {
    expect(blank).toMatch(/>Guardar borrador</);
    expect(blank).toMatch(/>Publicar</);
    expect(blank).not.toMatch(/>Despublicar</);
    expect(blank).not.toMatch(/name="id"/);
  });

  it("un borrador existente lleva su id oculto y ofrece Guardar y Publicar, con el slug editable", () => {
    const rendered = html(createElement(PostEditor, { categories: CATEGORIES, imageOrigin: ORIGIN, post: { id: POST_DRAFT, title: "T", slug: "t", content: "c", status: "draft", categoryIds: [CAT_A] } }));
    expect(rendered).toMatch(new RegExp(`<input[^>]*type="hidden"[^>]*name="id"[^>]*value="${POST_DRAFT}"|<input[^>]*name="id"[^>]*value="${POST_DRAFT}"[^>]*type="hidden"`));
    expect(rendered).toMatch(/>Publicar</);
    expect(rendered).not.toMatch(/<input[^>]*name="slug"[^>]*readOnly/i);
    expect(rendered).toMatch(new RegExp(`value="${CAT_A}"[^>]*checked|checked=""[^>]*value="${CAT_A}"`));
  });

  it("una entrada publicada tiene el slug en solo lectura con el aviso, y ofrece Despublicar", () => {
    const rendered = html(createElement(PostEditor, { categories: CATEGORIES, imageOrigin: ORIGIN, post: { id: POST_PUBLISHED, title: "T", slug: "t", content: "c", status: "published", categoryIds: [] } }));
    expect(rendered).toMatch(/<input[^>]*name="slug"[^>]*readOnly=""|<input[^>]*readOnly=""[^>]*name="slug"/);
    expect(rendered).toContain("Despublícala primero");
    expect(rendered).toMatch(/>Despublicar</);
    expect(rendered).not.toMatch(/>Guardar borrador</);
  });

  it("tiene las pestañas Editar y Vista previa para móvil", () => {
    expect(blank).toMatch(/role="tablist"/);
    expect(blank).toMatch(/role="tab"[^>]*>Editar</);
    expect(blank).toMatch(/role="tab"[^>]*>Vista previa</);
  });
});

describe("PostEditor: errores accesibles", () => {
  const state = { ok: false as const, message: "Revisa los campos marcados.", fieldErrors: { title: "El título es obligatorio.", slug: "Ya existe una entrada con esa dirección." } };
  const rendered = html(createElement(PostEditor, { categories: CATEGORIES, imageOrigin: ORIGIN, initialState: state }));

  it("el resumen de errores es un role=alert", () => {
    expect(rendered).toMatch(/role="alert"[^>]*>[\s\S]*Revisa los campos marcados\./);
  });

  it("cada campo con error queda marcado como inválido y apunta a su mensaje", () => {
    for (const [field, text] of [["title", "El título es obligatorio."], ["slug", "Ya existe una entrada con esa dirección."]] as const) {
      const input = rendered.match(new RegExp(`<input[^>]*name="${field}"[^>]*>`))?.[0] ?? "";
      expect(input, field).toContain('aria-invalid="true"');
      const describedBy = input.match(/aria-describedby="([^"]+)"/)?.[1];
      expect(describedBy, field).toBeTruthy();
      expect(rendered).toMatch(new RegExp(`id="${describedBy}"[^>]*>[^<]*${text.replace(/\./g, "\\.")}`));
    }
  });

  it("un campo sin error no se marca como inválido", () => {
    const textarea = rendered.match(/<textarea[^>]*>/)?.[0] ?? "";
    expect(textarea).not.toContain('aria-invalid="true"');
  });
});

describe("MarkdownPreview", () => {
  const HOSTILE = '## Título\n\n<script>window.__xss=1</script>\n\n<img src=x onerror="window.__xss=2">\n\n[trampa](javascript:window.__xss=3)\n\n![externa](https://example.com/x.png)';

  it("produce exactamente el mismo HTML que el componente Markdown del blog", () => {
    const expected = html(createElement(Markdown, { source: HOSTILE, imageOrigin: ORIGIN }));
    expect(html(createElement(MarkdownPreview, { source: HOSTILE, imageOrigin: ORIGIN }))).toContain(expected);
  });

  it("no deja pasar script, manejadores de eventos, javascript: ni imágenes externas", () => {
    const rendered = html(createElement(MarkdownPreview, { source: HOSTILE, imageOrigin: ORIGIN }));
    expect(rendered).not.toMatch(/<script|<iframe|\sonerror=|href="javascript:|example\.com\/x\.png/i);
  });

  it("sin contenido muestra un texto de ayuda", () => {
    expect(html(createElement(MarkdownPreview, { source: "", imageOrigin: ORIGIN }))).toMatch(/Nada que mostrar|vacía/i);
  });

  it("es una región con nombre para lectores de pantalla", () => {
    expect(html(createElement(MarkdownPreview, { source: "x", imageOrigin: ORIGIN }))).toMatch(/aria-label="Vista previa"|aria-labelledby/);
  });
});

describe("CategoryManager y AdminNav", () => {
  const categories = [
    { id: CAT_A, name: "Fuego", slug: "fuego", postCount: 3 },
    { id: CAT_B, name: "Agua", slug: "agua", postCount: 0 },
  ];
  const rendered = html(createElement(CategoryManager, { categories }));

  it("tiene el formulario de alta con su etiqueta", () => {
    expect(rendered).toMatch(/<label[^>]*for="([^"]+)"[^>]*>Nombre de la nueva categoría<\/label>/);
  });

  it("lista cada categoría con su recuento de entradas, su renombrado y su eliminación", () => {
    for (const name of ["Fuego", "Agua"]) expect(rendered).toContain(name);
    expect(rendered).toMatch(/3 entradas/);
    expect(rendered).toMatch(/0 entradas|Sin entradas/);
    expect((rendered.match(/>Guardar nombre</g) ?? []).length).toBe(2);
    expect((rendered.match(/>Eliminar</g) ?? []).length).toBe(2);
  });

  it("la navegación enlaza Entradas y Categorías y marca la actual", () => {
    const nav = html(createElement(AdminNav, { current: "categories" }));
    expect(nav).toMatch(/href="\/admin"[^>]*>Entradas</);
    expect(nav).toMatch(/aria-current="page"[^>]*>Categorías<|href="\/admin\/categorias"[^>]*aria-current="page"/);
  });
});
