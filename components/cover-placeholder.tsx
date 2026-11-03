import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Marcador neutro de una entrada sin portada: decorativo y oculto a los lectores de pantalla (sin texto ni imagen). */
export function CoverPlaceholder({ className }: { className?: string }) {
  return (
    <div data-slot="cover-placeholder" aria-hidden="true" className={cn("flex items-center justify-center bg-muted text-gold", className)}>
      <Sparkles aria-hidden className="size-10" />
    </div>
  );
}
