import { Markdown } from "@/components/markdown";

/**
 * Vista previa del editor. Usa EXACTAMENTE el mismo componente (con su misma lista blanca de etiquetas) que la
 * entrada pública: lo que ve el admin aquí es lo que verá el lector, y el contenido hostil no se ejecuta.
 */
export function MarkdownPreview({ source, imageOrigin }: { source: string; imageOrigin?: string }) {
  return (
    <section aria-label="Vista previa" className="min-h-72 rounded-lg border bg-card p-4">
      {source.trim() === "" ? (
        <p className="text-base text-muted-foreground">Nada que mostrar todavía: escribe contenido para ver la vista previa.</p>
      ) : (
        <div className="article-body mx-auto w-full max-w-[70ch] [overflow-wrap:anywhere]">
          <Markdown source={source} imageOrigin={imageOrigin} />
        </div>
      )}
    </section>
  );
}
