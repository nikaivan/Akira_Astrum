import Link from "next/link";
import { Constellation, Ornament } from "@/components/ornaments";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Héroe de la portada (superficie noche): el único h1 de la página, su presentación y el acceso a la calculadora. */
export function HomeHero() {
  return (
    <section data-surface="night" className="relative isolate overflow-hidden border-b">
      <Constellation className="pointer-events-none absolute inset-0 -z-10 size-full opacity-60" />
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-20 text-center sm:py-28">
        <Ornament />
        <h1 className="font-heading text-6xl leading-none font-light tracking-tight sm:text-8xl">Akira Astrum</h1>
        <p className="max-w-prose text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Astrología con calma: lecturas serenas y una calculadora de compatibilidad entre signos.
        </p>
        <Link
          href="/compatibilidad"
          className={cn(buttonVariants({ size: "touch" }), "mt-2 px-7 shadow-soft-lg motion-safe:transition-transform motion-safe:hover:-translate-y-0.5")}
        >
          Calcular compatibilidad
        </Link>
      </div>
    </section>
  );
}
