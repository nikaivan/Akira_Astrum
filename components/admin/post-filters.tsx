import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ListFilters } from "@/lib/admin/posts/filters";

const STATUS_PARAM = { all: "", draft: "borrador", published: "publicada" } as const;

/** Filtros del listado: un formulario GET, así el estado vive en la URL y funciona sin JavaScript. */
export function PostFilters({ status, category, categories }: ListFilters & { categories: { name: string; slug: string }[] }) {
  return (
    <form method="get" action="/admin" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="grid gap-1">
        <label htmlFor="filter-status" className="text-base font-medium">
          Estado
        </label>
        {/* eslint-disable-next-line security/detect-object-injection -- clave de un conjunto cerrado */}
        <Select id="filter-status" name="estado" defaultValue={STATUS_PARAM[status]}>
          <option value="">Todas</option>
          <option value="borrador">Borradores</option>
          <option value="publicada">Publicadas</option>
        </Select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="filter-category" className="text-base font-medium">
          Categoría
        </label>
        <Select id="filter-category" name="categoria" defaultValue={category ?? ""}>
          <option value="">Todas</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" className="h-11 px-4">
        Filtrar
      </Button>
    </form>
  );
}
