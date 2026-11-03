import type { Metadata } from "next";
import { PostCard } from "@/components/post-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pageTitle } from "@/lib/blog/metadata";
import { listPublishedPosts } from "@/lib/blog/queries";
import { createPublicClient } from "@/lib/supabase/public";

// Siempre dinámica: nada de esta página se guarda en caché.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: pageTitle("Blog"),
  description: "Todas las entradas del blog de astrología de Akira Astrum.",
};

const MAX_ENTRIES = 50;

export default async function BlogPage() {
  const result = await listPublishedPosts(createPublicClient(), { limit: MAX_ENTRIES, origin: process.env.NEXT_PUBLIC_SUPABASE_URL });
  if (result.status !== "ok") throw new Error("Lectura no disponible");

  return (
    <>
      <SiteHeader current="blog" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
        <h1 className="text-4xl font-semibold sm:text-5xl">Blog</h1>
        {result.data.length === 0 ? (
          <p className="text-lg text-muted-foreground">Todavía no hay entradas.</p>
        ) : (
          <ul className="flex flex-col gap-8">
            {result.data.map((post) => (
              <li key={post.id}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
