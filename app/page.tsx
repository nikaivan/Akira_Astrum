import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <h1 className="text-5xl font-semibold sm:text-6xl">Akira Astrum</h1>
        <p className="max-w-prose text-lg leading-relaxed text-muted-foreground">
          Astrología con calma: lecturas serenas y una calculadora de compatibilidad entre signos.
        </p>
        <Link href="/compatibilidad" className={cn(buttonVariants(), "h-11 px-5 text-base")}>
          Calcular compatibilidad
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
