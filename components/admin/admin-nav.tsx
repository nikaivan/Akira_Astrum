"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Section = "posts" | "categories";

const linkClass =
  "inline-flex min-h-11 items-center rounded-lg px-3 text-base underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:font-semibold aria-[current=page]:text-primary aria-[current=page]:underline aria-[current=page]:decoration-2";

/** Navegación del panel, siempre visible (también en modo aplicación, sin barra de direcciones). */
export function AdminNav({ current }: { current?: Section }) {
  const pathname = usePathname();
  const active: Section | undefined = current ?? (pathname?.startsWith("/admin/categorias") ? "categories" : pathname?.startsWith("/admin") ? "posts" : undefined);

  return (
    <nav aria-label="Administración" className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-1 px-4 py-1">
        <Link href="/admin" aria-current={active === "posts" ? "page" : undefined} className={cn(linkClass)}>
          Entradas
        </Link>
        <Link href="/admin/categorias" aria-current={active === "categories" ? "page" : undefined} className={cn(linkClass)}>
          Categorías
        </Link>
      </div>
    </nav>
  );
}
