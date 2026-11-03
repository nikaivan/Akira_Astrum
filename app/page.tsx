import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { textLinkClass } from "@/components/ui/link-styles";
import { PostCard } from "@/components/post-card";
import { PostGrid } from "@/components/post-grid";
import { listPublishedPosts } from "@/lib/blog/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { cn } from "@/lib/utils";

// Siempre dinámica: nada de esta página se guarda en caché, así que una entrada despublicada deja de verse al instante.
export const dynamic = "force-dynamic";

const LATEST = 7; // la destacada y las 6 siguientes

export default async function Home() {
  const result = await listPublishedPosts(createPublicClient(), {
    limit: LATEST,
    origin: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  if (result.status !== "ok") throw new Error("Lectura no disponible");

  const [featured, ...rest] = result.data;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10">
        <section className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-heading text-5xl font-semibold sm:text-6xl">
            Akira Astrum
          </h1>
          <p className="max-w-prose text-lg leading-relaxed text-muted-foreground">
            Astrología con calma: lecturas serenas y una calculadora de
            compatibilidad entre signos.
          </p>
          <Link
            href="/compatibilidad"
            className={cn(buttonVariants(), "h-11 px-5 text-base")}
          >
            Calcular compatibilidad
          </Link>
        </section>
        <section
          aria-labelledby="latest-heading"
          className="flex flex-col gap-6"
        >
          <h2
            id="latest-heading"
            className="font-heading text-3xl font-semibold"
          >
            Últimas entradas
          </h2>
          {featured ? (
            <PostCard post={featured} headingLevel={3} variant="featured" />
          ) : (
            <p className="text-lg text-muted-foreground">
              Todavía no hay entradas.
            </p>
          )}
          {rest.length > 0 ? <PostGrid posts={rest} headingLevel={3} /> : null}
          <Link
            href="/blog"
            className={cn(textLinkClass, "self-start underline")}
          >
            Ver todas las entradas
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
