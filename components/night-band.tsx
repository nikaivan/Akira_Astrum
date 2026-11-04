import type { ReactNode } from "react";
import { Constellation } from "@/components/ornaments";
import { cn } from "@/lib/utils";

/** Banda a todo el ancho en superficie noche con constelaciones de fondo: la comparten el héroe de la portada y la banda de título. */
export function NightBand({ children, constellationClassName = "opacity-40" }: { children: ReactNode; constellationClassName?: string }) {
  return (
    <section data-surface="night" className="relative isolate overflow-hidden border-b">
      <Constellation className={cn("pointer-events-none absolute inset-0 -z-10 size-full", constellationClassName)} />
      {children}
    </section>
  );
}
