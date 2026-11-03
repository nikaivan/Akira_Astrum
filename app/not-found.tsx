import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** Único 404 del sitio: borrador, entrada despublicada, inexistente y slug raro dicen exactamente lo mismo. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-4 px-4 py-16">
        <h1 className="text-4xl font-semibold">Página no encontrada</h1>
        <p className="text-lg text-muted-foreground">No hemos encontrado lo que buscas.</p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Volver a la portada
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
