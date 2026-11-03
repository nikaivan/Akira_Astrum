import { revalidatePath } from "next/cache";

/**
 * Tras cada mutación exitosa. El blog público es dinámico y sin caché (ADR 0014), así que no hay caché de
 * servidor que quede obsoleta; esto refresca además la caché del enrutador del cliente y el propio panel,
 * para que una entrada despublicada o eliminada deje de verse sin demora.
 */
export function revalidatePublicPages(): void {
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/blog/[slug]", "page");
  revalidatePath("/categorias/[slug]", "page");
  revalidatePath("/admin", "layout");
}
