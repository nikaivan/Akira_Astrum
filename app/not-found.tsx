import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { textLinkClass } from "@/components/ui/link-styles";
import { cn } from "@/lib/utils";

/** Único 404 del sitio: borrador, entrada despublicada, inexistente y slug raro dicen exactamente lo mismo. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-4 px-4 py-16">
        <h1 className="text-4xl font-semibold">Página no encontrada</h1>
        <p className="text-lg text-muted-foreground">No hemos encontrado lo que buscas.</p>
        <Link href="/" className={cn(textLinkClass, "underline")}>
          Volver a la portada
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
