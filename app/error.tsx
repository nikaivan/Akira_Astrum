"use client";

import { PageBanner } from "@/components/page-banner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

/** Error genérico (A10): nunca muestra el mensaje, la traza ni el resumen del error. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <PageBanner title="Algo ha fallado" description="No se ha podido cargar la página. Inténtalo de nuevo más tarde." />
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-12">
          <Button type="button" onClick={reset} className="h-11 text-base">
            Reintentar
          </Button>
        </div>
      </main>
    </>
  );
}
