import Link from "next/link";
import { textLinkClass } from "@/components/ui/link-styles";

/** Pie de las páginas públicas, con el enlace a la intranet (docs/design.md §5). */
export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-1 text-base text-muted-foreground">
        <span>© Akira Astrum</span>
        <Link href="/login" className={textLinkClass}>
          Intranet
        </Link>
      </div>
    </footer>
  );
}
