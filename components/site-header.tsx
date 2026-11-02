import Link from "next/link";
import { cn } from "@/lib/utils";

const linkClass =
  "inline-flex min-h-11 items-center rounded-lg px-2 text-base underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

/** Cabecera de las páginas públicas: siempre visible, con enlace de vuelta a la portada (modo aplicación). */
export function SiteHeader({ current }: { current?: "compatibility" }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-1">
        <Link href="/" className={cn(linkClass, "font-heading text-2xl font-semibold text-foreground no-underline")}>
          Akira Astrum
        </Link>
        <nav aria-label="Principal">
          <Link
            href="/compatibilidad"
            aria-current={current === "compatibility" ? "page" : undefined}
            className={cn(linkClass, "text-primary", current === "compatibility" && "font-semibold underline")}
          >
            Compatibilidad
          </Link>
        </nav>
      </div>
    </header>
  );
}
