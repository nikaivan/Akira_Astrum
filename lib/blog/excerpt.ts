const DEFAULT_MAX = 160;

/** Texto plano de un Markdown (sin marcas, sin etiquetas y sin ángulos: va a una metaetiqueta). */
function plainText(markdown: string): string {
  return markdown
    .replace(/^```.*$/gm, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/^[ \t]*#{1,6}[ \t]*/gm, "")
    .replace(/^[ \t]*(?:[-+*]|\d+\.)[ \t]+/gm, "")
    .replace(/^[\s\-=_*]+$/gm, " ")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Descripción de la página: los primeros ~160 caracteres del texto plano, cortados en una palabra. */
export function excerptOf(markdown: string, max = DEFAULT_MAX): string {
  const text = plainText(markdown);
  if (text.length <= max) return text;

  const limit = max - 1; // deja sitio para la elipsis
  let cut = text.slice(0, limit);
  if (text.charAt(limit) !== " ") {
    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > 0) cut = cut.slice(0, lastSpace);
  }
  return `${cut.trimEnd()}…`;
}
