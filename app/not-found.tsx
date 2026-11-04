import Link from "next/link";
import { PageBanner } from "@/components/page-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { textLinkClass } from "@/components/ui/link-styles";
import { cn } from "@/lib/utils";

/** Único 404 del sitio: borrador, entrada despublicada, inexistente y slug raro dicen exactamente lo mismo. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <PageBanner title="Página no encontrada" description="No hemos encontrado lo que buscas." />
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-12">
          <Link href="/" className={cn(textLinkClass, "underline")}>
            Volver a la portada
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
