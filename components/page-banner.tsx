import { NightBand } from "@/components/night-band";
import { Ornament } from "@/components/ornaments";
import { container } from "@/components/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Banda de título de una página (superficie noche): el h1, su descripción opcional y un adorno. El título se pinta como texto. */
export function PageBanner({ title, description }: { title: string; description?: string }) {
  return (
    <NightBand>
      <div className={cn(container.reading, "flex flex-col items-center gap-4 py-12 text-center sm:py-16")}>
        <h1 className="font-heading text-5xl leading-tight font-light [overflow-wrap:anywhere] sm:text-6xl">{title}</h1>
        {description ? <p className="max-w-prose text-lg leading-relaxed text-muted-foreground">{description}</p> : null}
        <Ornament />
      </div>
    </NightBand>
  );
}
