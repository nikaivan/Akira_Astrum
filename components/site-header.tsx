import Link from "next/link";
import { Star } from "@/components/ornaments";
import { container } from "@/components/ui/surface-styles";
import { cn } from "@/lib/utils";

const linkClass =
  "inline-flex min-h-11 items-center rounded-lg px-2 text-base text-foreground underline-offset-8 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors";

/** Cabecera de las páginas públicas (superficie noche): siempre visible, con enlace de vuelta a la portada (modo aplicación). */
export function SiteHeader({
  current,
}: {
  current?: "blog" | "compatibility";
}) {
  return (
    <header data-surface="night" className="border-b">
      <div className={cn(container.wide, "flex flex-wrap items-center justify-between gap-x-4 py-1")}>
        <Link
          href="/"
          className={cn(linkClass, "gap-2 font-heading text-xl font-medium tracking-[0.06em] sm:text-2xl")}
        >
          <Star className="size-3.5 text-gold" />
          Akira Astrum
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1">
          <Link
            href="/blog"
            aria-current={current === "blog" ? "page" : undefined}
            className={cn(linkClass, current === "blog" && "font-semibold text-primary underline decoration-2")}
          >
            Blog
          </Link>
          <Link
            href="/compatibilidad"
            aria-current={current === "compatibility" ? "page" : undefined}
            className={cn(linkClass, current === "compatibility" && "font-semibold text-primary underline decoration-2")}
          >
            Compatibilidad
          </Link>
        </nav>
      </div>
    </header>
  );
}
