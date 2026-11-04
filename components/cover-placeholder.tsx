import { Constellation, Star } from "@/components/ornaments";
import { cn } from "@/lib/utils";

/** Marcador neutro de una entrada sin portada: una constelación sobre la noche. Decorativo y oculto a los lectores de pantalla (sin texto ni imagen). */
export function CoverPlaceholder({ className }: { className?: string }) {
  return (
    <div data-slot="cover-placeholder" data-surface="night" aria-hidden="true" className={cn("relative isolate flex items-center justify-center overflow-hidden", className)}>
      <Constellation className="absolute inset-0 -z-10 size-full opacity-70" />
      <Star className="size-8 text-gold" />
    </div>
  );
}
