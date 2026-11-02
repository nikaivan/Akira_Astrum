import Link from "next/link";

/** Pie de las páginas públicas, con el enlace a la intranet (docs/design.md §5). */
export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-1 text-base text-muted-foreground">
        <span>© Akira Astrum</span>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Intranet
        </Link>
      </div>
    </footer>
  );
}
