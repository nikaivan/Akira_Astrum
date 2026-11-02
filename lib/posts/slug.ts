const MAX_LENGTH = 80;

// Seguro: el guion obligatorio entre grupos evita el retroceso exponencial.
// eslint-disable-next-line security/detect-unsafe-regex
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function truncate(slug: string, max: number): string {
  return slug.slice(0, max).replace(/-+$/, "");
}

function isValidSlug(slug: string): boolean {
  return slug.length <= MAX_LENGTH && SLUG_PATTERN.test(slug);
}

export function slugify(title: string): string {
  const slug = truncate(
    title
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/, ""),
    MAX_LENGTH,
  );

  if (!slug) throw new Error("Título no válido");
  return slug;
}

export function uniqueSlug(base: string, taken: readonly string[]): string {
  if (!isValidSlug(base)) throw new Error("Slug no válido");

  const used = new Set(taken);
  if (!used.has(base)) return base;

  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = truncate(base, MAX_LENGTH - suffix.length) + suffix;
    if (!used.has(candidate)) return candidate;
  }
}
