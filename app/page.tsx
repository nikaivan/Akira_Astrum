import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { PostCard } from "@/components/post-card";
import { listPublishedPosts } from "@/lib/blog/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { cn } from "@/lib/utils";

// Siempre dinámica: nada de esta página se guarda en caché, así que una entrada despublicada deja de verse al instante.
export const dynamic = "force-dynamic";

const LATEST = 7; // la destacada y las 6 siguientes

export default async function Home() {
  const result = await listPublishedPosts(createPublicClient(), { limit: LATEST, origin: process.env.NEXT_PUBLIC_SUPABASE_URL });
  if (result.status !== "ok") throw new Error("Lectura no disponible");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12">
        <section className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-5xl font-semibold sm:text-6xl">Akira Astrum</h1>
          <p className="max-w-prose text-lg leading-relaxed text-muted-foreground">
            Astrología con calma: lecturas serenas y una calculadora de compatibilidad entre signos.
          </p>
          <Link href="/compatibilidad" className={cn(buttonVariants(), "h-11 px-5 text-base")}>
            Calcular compatibilidad
          </Link>
        </section>
        <section aria-labelledby="latest-heading" className="flex flex-col gap-6">
          <h2 id="latest-heading" className="text-3xl font-semibold">
            Últimas entradas
          </h2>
          {result.data.length === 0 ? (
            <p className="text-lg text-muted-foreground">Todavía no hay entradas.</p>
          ) : (
            <ul className="flex flex-col gap-8">
              {result.data.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} headingLevel={3} />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/blog"
            className="inline-flex min-h-11 items-center self-start rounded-lg text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Ver todas las entradas
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
