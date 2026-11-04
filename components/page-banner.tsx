import { Constellation, Ornament } from "@/components/ornaments";

/** Banda de título de una página (superficie noche): el h1, su descripción opcional y un adorno. El título se pinta como texto. */
export function PageBanner({ title, description }: { title: string; description?: string }) {
  return (
    <section data-surface="night" className="relative isolate overflow-hidden border-b">
      <Constellation className="pointer-events-none absolute inset-0 -z-10 size-full opacity-40" />
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-12 text-center sm:py-16">
        <h1 className="font-heading text-5xl leading-tight font-light [overflow-wrap:anywhere] sm:text-6xl">{title}</h1>
        {description ? <p className="max-w-prose text-lg leading-relaxed text-muted-foreground">{description}</p> : null}
        <Ornament />
      </div>
    </section>
  );
}
