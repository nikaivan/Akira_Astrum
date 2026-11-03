import { isValidSlug } from "@/lib/posts/slug";

export type ListFilters = { status: "all" | "draft" | "published"; category: string | null };
type Params = Record<string, string | string[] | undefined>;

const STATUS_BY_PARAM = { borrador: "draft", publicada: "published" } as const;

/** Filtros del listado desde la URL. Cualquier valor no válido vuelve al valor por defecto. */
export function parseListFilters(params: Params): ListFilters {
  const estado = params.estado;
  const categoria = params.categoria;
  const status = typeof estado === "string" && Object.hasOwn(STATUS_BY_PARAM, estado) ? STATUS_BY_PARAM[estado as keyof typeof STATUS_BY_PARAM] : "all";
  const category = typeof categoria === "string" && isValidSlug(categoria) ? categoria : null;
  return { status, category };
}
