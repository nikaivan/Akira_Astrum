import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PostCard } from "@/components/post-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pageTitle } from "@/lib/blog/metadata";
import { getCategoryWithPosts } from "@/lib/blog/queries";
import { createPublicClient } from "@/lib/supabase/public";

// Siempre dinámica: nada de esta página se guarda en caché.
export const dynamic = "force-dynamic";

const MAX_ENTRIES = 50;

// Una sola lectura por petición (la comparten la página y sus metadatos); no se guarda entre peticiones.
const load = cache((slug: string) =>
  getCategoryWithPosts(createPublicClient(), slug, { limit: MAX_ENTRIES, origin: process.env.NEXT_PUBLIC_SUPABASE_URL }),
);

export async function generateMetadata({ params }: PageProps<"/categorias/[slug]">): Promise<Metadata> {
  const result = await load((await params).slug);
  if (result.status === "not-found") notFound();
  if (result.status === "error") throw new Error("Lectura no disponible");
  return { title: pageTitle(result.data.category.name), description: `Entradas del blog sobre ${result.data.category.name}.` };
}

export default async function CategoryPage({ params }: PageProps<"/categorias/[slug]">) {
  const result = await load((await params).slug);
  if (result.status === "not-found") notFound();
  if (result.status === "error") throw new Error("Lectura no disponible");
  const { category, posts } = result.data;

  return (
    <>
      <SiteHeader current="blog" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
        <h1 className="text-4xl font-semibold sm:text-5xl">{category.name}</h1>
        {posts.length === 0 ? (
          <p className="text-lg text-muted-foreground">Todavía no hay entradas en esta categoría.</p>
        ) : (
          <ul className="flex flex-col gap-8">
            {posts.map((post) => (
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
