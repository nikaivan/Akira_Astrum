import { revalidatePath } from "next/cache";
import { toActionState } from "./state";

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

/** Tras un servicio: si cambió algo se invalida la caché; en cualquier caso se devuelve el estado que ve el formulario. */
export function settleAndRevalidate(result: Parameters<typeof toActionState>[0]): ReturnType<typeof toActionState> {
  if (result.ok) revalidatePublicPages();
  return toActionState(result);
}
