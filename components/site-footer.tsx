import Link from "next/link";
import { Star } from "@/components/ornaments";
import { textLinkClass } from "@/components/ui/link-styles";
import { container } from "@/components/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Pie de las páginas públicas (superficie noche), con el enlace a la intranet salvo en la propia página de acceso (docs/design.md §5). */
export function SiteFooter({ intranetLink = true }: { intranetLink?: boolean }) {
  return (
    <footer data-surface="night" className="border-t safe-bottom">
      <div className={cn(container.wide, "flex flex-col items-center gap-1 py-4 text-base text-muted-foreground sm:flex-row sm:justify-between")}>
        <span className="inline-flex min-h-11 items-center gap-2">
          <Star className="size-3 text-gold" />© Akira Astrum
        </span>
        {intranetLink ? (
          <Link href="/login" className={textLinkClass}>
            Intranet
          </Link>
        ) : null}
      </div>
    </footer>
  );
}
