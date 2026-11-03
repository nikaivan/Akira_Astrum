import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ListFilters } from "@/lib/admin/posts/filters";
import { cardClass, labelClass } from "./styles";

const STATUS_PARAM: Record<ListFilters["status"], string> = { all: "", draft: "borrador", published: "publicada" };

/** Filtros del listado: un formulario GET, así el estado vive en la URL y funciona sin JavaScript. */
export function PostFilters({ status, category, categories }: ListFilters & { categories: { name: string; slug: string }[] }) {
  return (
    <form method="get" action="/admin" className={`${cardClass} grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end`}>
      <div className="grid gap-1">
        <label htmlFor="filter-status" className={labelClass}>
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
        <label htmlFor="filter-category" className={labelClass}>
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
      <Button type="submit" size="touch">
        Filtrar
      </Button>
    </form>
  );
}
