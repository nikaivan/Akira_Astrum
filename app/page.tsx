import Link from "next/link";
import { HomeHero } from "@/components/home-hero";
import { Ornament } from "@/components/ornaments";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
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
      <main className="flex flex-1 flex-col">
        <HomeHero />
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-14">
          <section aria-labelledby="latest-heading" className="flex flex-col gap-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <h2 id="latest-heading" className="font-heading text-4xl font-light sm:text-5xl">
                Últimas entradas
              </h2>
              <Ornament />
            </div>
            {featured ? (
              <PostCard post={featured} headingLevel={3} variant="featured" />
            ) : (
              <p className="text-center text-lg text-muted-foreground">Todavía no hay entradas.</p>
            )}
            {rest.length > 0 ? <PostGrid posts={rest} headingLevel={3} /> : null}
            <Link href="/blog" className={cn(textLinkClass, "self-center underline")}>
              Ver todas las entradas
            </Link>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
