import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "@/components/markdown";

export const ORIGIN = "https://abcdefghijklmnopqrst.supabase.co";
export const IMAGE_URL = `${ORIGIN}/storage/v1/object/public/post-images/11111111-2222-3333-4444-555555555555.png`;

export const render = (source: string, imageOrigin: string | undefined = undefined) =>
  renderToStaticMarkup(createElement(Markdown, { source, imageOrigin }));

// Lista blanca que se espera de la SALIDA (se escribe aquí a propósito, no se importa de la aplicación).
// Sin imágenes: next/image añade atributos propios (srcset, style…) que se prueban aparte.
export const ALLOWED: Record<string, readonly string[]> = {
  p: [],
  br: [],
  strong: [],
  em: [],
  code: ["class"],
  pre: ["tabindex"], // los bloques de código con desplazamiento deben poder enfocarse con el teclado
  blockquote: [],
  ul: [],
  ol: [],
  li: [],
  hr: [],
  a: ["href", "target", "rel"],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
};

type Tag = { name: string; attributes: Map<string, string>; closing: boolean };

/** Etiquetas reales de la salida (el texto escapado no genera ninguna). */
export function tagsOf(html: string): Tag[] {
  const tags: Tag[] = [];
  for (const match of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g)) {
    const attributes = new Map<string, string>();
    // Seguro: sin cuantificadores anidados; el grupo opcional no puede retroceder de forma exponencial.
    // eslint-disable-next-line security/detect-unsafe-regex
    for (const attr of match[3].matchAll(/\s([^\s=>/]+)(?:="([^"]*)")?/g)) attributes.set(attr[1], attr[2] ?? "");
    tags.push({ name: match[2], attributes, closing: match[1] === "/" });
  }
  return tags;
}

export function anchors(html: string) {
  return [...html.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => {
    const attributes = new Map([...match[1].matchAll(/([^\s=]+)="([^"]*)"/g)].map((attr) => [attr[1], attr[2]]));
    return { href: attributes.get("href"), target: attributes.get("target"), rel: attributes.get("rel"), text: match[2] };
  });
}

/** Devuelve las razones por las que la salida NO es inerte (vacío = inerte). */
export function problemsIn(html: string): string[] {
  const problems: string[] = [];
  for (const tag of tagsOf(html)) {
    const allowed = Reflect.get(ALLOWED, tag.name) as readonly string[] | undefined;
    if (!allowed) {
      problems.push(`etiqueta no permitida: <${tag.name}>`);
      continue;
    }
    if (tag.closing) continue;
    for (const [attribute, value] of tag.attributes) {
      if (!allowed.includes(attribute)) problems.push(`atributo no permitido: ${tag.name}[${attribute}]`);
      if (attribute === "href" && !/^(https?:\/\/|mailto:)/i.test(value)) problems.push(`href no permitido: ${value}`);
      if (attribute === "class" && !/^language-[a-z0-9-]+$/.test(value)) problems.push(`class no permitida: ${value}`);
      if (attribute === "tabindex" && (tag.name !== "pre" || value !== "0")) problems.push(`tabindex no permitido: ${tag.name}[${value}]`);
      if (attribute === "rel" && value !== "noopener noreferrer") problems.push(`rel inesperado: ${value}`);
      if (attribute === "target" && value !== "_blank") problems.push(`target inesperado: ${value}`);
    }
  }
  if (/javascript:|vbscript:|data:|livescript:|file:/i.test(html.replace(/&[a-z#0-9]+;/gi, ""))) {
    // Solo importa si está en un atributo; en texto escapado es inofensivo (se comprueba arriba).
    for (const tag of tagsOf(html)) {
      for (const value of tag.attributes.values()) {
        if (/^\s*(javascript|vbscript|data|livescript|file):/i.test(value)) problems.push(`esquema peligroso en un atributo: ${value}`);
      }
    }
  }
  return problems;
}
