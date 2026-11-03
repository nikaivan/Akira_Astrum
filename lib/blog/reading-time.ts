const WORDS_PER_MINUTE = 200;

/** Minutos de lectura: palabras / 200 redondeado hacia arriba, mínimo 1. Ignora marcas y direcciones. */
export function readingMinutes(markdown: string): number {
  const text = markdown.replace(/https?:\/\/\S+/g, " ");
  const words = text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
