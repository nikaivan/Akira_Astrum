"use client";

import { PageBanner } from "@/components/page-banner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { container } from "@/components/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Error genérico (A10): nunca muestra el mensaje, la traza ni el resumen del error. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <PageBanner title="Algo ha fallado" description="No se ha podido cargar la página. Inténtalo de nuevo más tarde." />
        <div className={cn(container.reading, "flex flex-1 flex-col items-center py-12")}>
          <Button type="button" onClick={reset} className="h-11 text-base">
            Reintentar
          </Button>
        </div>
      </main>
    </>
  );
}
