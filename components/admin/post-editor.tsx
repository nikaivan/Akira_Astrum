"use client";

import { useActionState, useDeferredValue, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SLUG_LOCKED } from "@/lib/admin/messages";
import { createPost, updatePost } from "@/lib/admin/posts/actions";
import type { ActionState } from "@/lib/admin/state";
import { slugify } from "@/lib/posts/slug";
import { cn } from "@/lib/utils";
import { MarkdownPreview } from "./markdown-preview";

type PostValues = { id: string; title: string; slug: string; content: string; status: "draft" | "published"; categoryIds: string[] };
type Props = {
  post?: PostValues;
  categories: { id: string; name: string }[];
  imageOrigin?: string;
  /** Solo para pintar el formulario con errores (pruebas y vistas previas). */
  initialState?: ActionState;
};

type Tab = "edit" | "preview";
const TABS: { id: Tab; label: string }[] = [
  { id: "edit", label: "Editar" },
  { id: "preview", label: "Vista previa" },
];

function slugFromTitle(title: string): string {
  try {
    return slugify(title);
  } catch {
    return "";
  }
}

const labelClass = "text-base font-medium";
const errorClass = "text-base font-medium text-destructive";
const helpClass = "text-base text-muted-foreground";

export function PostEditor({ post, categories, imageOrigin, initialState = null }: Props) {
  const [state, formAction, pending] = useActionState(post ? updatePost : createPost, initialState);
  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const summary = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [content, setContent] = useState(post?.content ?? "");
  const [selected, setSelected] = useState<string[]>(post?.categoryIds ?? []);
  const [tab, setTab] = useState<Tab>("edit");
  const previewSource = useDeferredValue(content);
  const slugLocked = post?.status === "published";

  useEffect(() => {
    if (state && !state.ok) summary.current?.focus();
  }, [state]);

  // El resumen repite los mensajes de cada campo, para que un lector de pantalla los oiga todos al llegar el foco.
  const summaryMessages = Object.entries(fieldErrors)
    .filter(([field]) => field !== "form")
    .map(([, message]) => message);

  // Las claves son un conjunto cerrado de campos del formulario.
  /* eslint-disable security/detect-object-injection */
  const describe = (field: "title" | "slug" | "content" | "categoryIds", help?: string) => (fieldErrors[field] ? `${field}-error` : help);
  const invalid = (field: "title" | "slug" | "content" | "categoryIds") => (fieldErrors[field] ? true : undefined);
  /* eslint-enable security/detect-object-injection */

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  return (
    <form action={formAction} noValidate className="grid gap-6">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}

      {state && !state.ok ? (
        <div ref={summary} role="alert" tabIndex={-1} className="rounded-lg border border-destructive bg-card p-4 text-base font-medium text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <p>{state.message}</p>
          {summaryMessages.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {summaryMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <p role="status" className={cn("text-base font-medium text-primary", state?.ok ? "" : "sr-only")}>
        {state?.ok ? state.message : ""}
      </p>

      <div className="grid gap-1">
        <label htmlFor="post-title" className={labelClass}>
          Título
        </label>
        <Input
          id="post-title"
          name="title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (!slugTouched) setSlug(slugFromTitle(event.target.value));
          }}
          aria-required="true"
          aria-invalid={invalid("title")}
          aria-describedby={describe("title")}
          autoComplete="off"
        />
        {fieldErrors.title ? (
          <p id="title-error" className={errorClass}>
            {fieldErrors.title}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1">
        <label htmlFor="post-slug" className={labelClass}>
          Dirección (slug)
        </label>
        <Input
          id="post-slug"
          name="slug"
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setSlugTouched(true);
          }}
          readOnly={slugLocked}
          aria-invalid={invalid("slug")}
          aria-describedby={describe("slug", "slug-help")}
          autoComplete="off"
          spellCheck={false}
        />
        {fieldErrors.slug ? (
          <p id="slug-error" className={errorClass}>
            {fieldErrors.slug}
          </p>
        ) : (
          <p id="slug-help" className={helpClass}>
            {slugLocked ? SLUG_LOCKED : "Se genera a partir del título; puedes cambiarla mientras sea un borrador. Cambiarla cambia la dirección pública."}
          </p>
        )}
      </div>

      <fieldset className="grid gap-2" aria-describedby={describe("categoryIds")} aria-invalid={invalid("categoryIds")}>
        <legend className={labelClass}>Categorías</legend>
        {categories.length === 0 ? (
          <p className={helpClass}>Todavía no hay categorías. Puedes crearlas en la sección Categorías.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <label key={category.id} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-base">
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={category.id}
                  checked={selected.includes(category.id)}
                  onChange={(event) => setSelected((current) => (event.target.checked ? [...current, category.id] : current.filter((id) => id !== category.id)))}
                  className="size-5"
                />
                {category.name}
              </label>
            ))}
          </div>
        )}
        {fieldErrors.categoryIds ? (
          <p id="categoryIds-error" className={errorClass}>
            {fieldErrors.categoryIds}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-3">
        <div role="tablist" aria-label="Editor y vista previa" className="flex gap-2 md:hidden">
          {TABS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => onTabKey(event, index)}
              className={cn(
                "min-h-11 rounded-lg border px-4 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                tab === item.id ? "border-primary bg-primary font-semibold text-primary-foreground" : "bg-card",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div id="panel-edit" className={cn("grid content-start gap-1", tab === "edit" ? "block" : "hidden", "md:grid")}>
            <label htmlFor="post-content" className={labelClass}>
              Contenido (Markdown)
            </label>
            <Textarea
              id="post-content"
              name="content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={18}
              aria-invalid={invalid("content")}
              aria-describedby={describe("content")}
              spellCheck
              className="min-h-72 font-mono"
            />
            {fieldErrors.content ? (
              <p id="content-error" className={errorClass}>
                {fieldErrors.content}
              </p>
            ) : null}
          </div>
          <div id="panel-preview" className={cn("grid content-start gap-1", tab === "preview" ? "block" : "hidden", "md:grid")}>
            <p className={cn(labelClass, "hidden md:block")} aria-hidden>
              Vista previa
            </p>
            <MarkdownPreview source={previewSource} imageOrigin={imageOrigin} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {post ? (
          <>
            <Button type="submit" name="intent" value="save" className="h-11 px-5" disabled={pending}>
              Guardar cambios
            </Button>
            {post.status === "draft" ? (
              <Button type="submit" name="intent" value="publish" variant="outline" className="h-11 px-5" disabled={pending}>
                Publicar
              </Button>
            ) : (
              <Button type="submit" name="intent" value="unpublish" variant="outline" className="h-11 px-5" disabled={pending}>
                Despublicar
              </Button>
            )}
          </>
        ) : (
          <>
            <Button type="submit" name="intent" value="save" className="h-11 px-5" disabled={pending}>
              Guardar borrador
            </Button>
            <Button type="submit" name="intent" value="publish" variant="outline" className="h-11 px-5" disabled={pending}>
              Publicar
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
