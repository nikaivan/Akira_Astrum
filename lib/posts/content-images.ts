import { GENERATED_NAME_SOURCE } from "@/lib/blog/cover";
import { httpsOrigin, STORAGE_IMAGE_PATH } from "@/lib/blog/image-config";

/** Sintaxis de las imágenes del contenido de una entrada: cómo se escriben, cuáles son del proyecto y dónde se insertan. */

// Cualquier espacio o carácter de control (saltos de línea incluidos) se reduce a un solo espacio.
const BLANKS = /[\u0000-\u001f\u007f\s]+/g;
const ESCAPED = /[\\[\]`*_<]/g;

/** `![texto](url)` en una sola línea y con el texto alternativo escapado: no puede cerrar la imagen ni abrir otra cosa. */
export function imageMarkdown(url: string, alt: string): string {
  const text = alt.replace(BLANKS, " ").trim().replace(ESCAPED, "\\$&");
  return `![${text}](${url})`;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * Nombres generados de las imágenes del bucket de este proyecto que menciona un contenido, sin repetir. Cuenta cualquier
 * aparición de la URL (no solo `![](…)`): quien la use para decidir qué borrar nunca debe pasar por alto una referencia.
 */
export function projectImageNames(markdown: string, origin: string | null | undefined): string[] {
  const base = httpsOrigin(origin);
  if (!base) return [];
  const names = new Set<string>();
  // Seguro: el prefijo está escapado y el nombre generado tiene longitud fija.
  // eslint-disable-next-line security/detect-non-literal-regexp
  const pattern = new RegExp(`${escapeRegExp(`${base}${STORAGE_IMAGE_PATH}`)}(${GENERATED_NAME_SOURCE})`, "g");
  for (const match of markdown.matchAll(pattern)) names.add(match[1]);
  return [...names];
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
const newlinesAtEnd = (text: string) => text.length - text.replace(/\n+$/, "").length;
const newlinesAtStart = (text: string) => text.length - text.replace(/^\n+/, "").length;

/** Escribe una línea en el texto, sustituyendo la selección, con una línea en blanco antes y después (sin duplicar las que ya hay). */
export function insertSnippet(text: string, start: number, end: number, snippet: string): { text: string; cursor: number } {
  const from = clamp(Math.min(start, end), text.length);
  const to = clamp(Math.max(start, end), text.length);
  const before = text.slice(0, from);
  const after = text.slice(to);
  const lead = before === "" ? "" : "\n".repeat(Math.max(0, 2 - newlinesAtEnd(before)));
  const trail = after === "" ? "" : "\n".repeat(Math.max(0, 2 - newlinesAtStart(after)));
  const head = `${before}${lead}${snippet}${trail}`;
  return { text: `${head}${after}`, cursor: head.length };
}
