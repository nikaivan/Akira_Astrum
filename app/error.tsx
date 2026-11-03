"use client";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

/** Error genérico (A10): nunca muestra el mensaje, la traza ni el resumen del error. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-4 px-4 py-16">
        <h1 className="text-4xl font-semibold">Algo ha fallado</h1>
        <p className="text-lg text-muted-foreground">No se ha podido cargar la página. Inténtalo de nuevo más tarde.</p>
        <Button type="button" onClick={reset} className="h-11 text-base">
          Reintentar
        </Button>
      </main>
    </>
  );
}
