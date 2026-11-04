import Link from "next/link";
import { NightBand } from "@/components/night-band";
import { Ornament } from "@/components/ornaments";
import { buttonVariants } from "@/components/ui/button";
import { container } from "@/components/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Héroe de la portada (superficie noche): el único h1 de la página, su presentación y el acceso a la calculadora. */
export function HomeHero() {
  return (
    <NightBand constellationClassName="opacity-60">
      <div className={cn(container.wide, "flex flex-col items-center gap-6 py-20 text-center sm:py-28")}>
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
    </NightBand>
  );
}
