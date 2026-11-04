import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageBanner } from "@/components/page-banner";
import { PostGrid } from "@/components/post-grid";
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
  getCategoryWithPosts(createPublicClient(), slug, {
    limit: MAX_ENTRIES,
    origin: process.env.NEXT_PUBLIC_SUPABASE_URL,
  }),
);

export async function generateMetadata({
  params,
}: PageProps<"/categorias/[slug]">): Promise<Metadata> {
  const result = await load((await params).slug);
  if (result.status === "not-found") notFound();
  if (result.status === "error") throw new Error("Lectura no disponible");
  return {
    title: pageTitle(result.data.category.name),
    description: `Entradas del blog sobre ${result.data.category.name}.`,
  };
}

export default async function CategoryPage({
  params,
}: PageProps<"/categorias/[slug]">) {
  const result = await load((await params).slug);
  if (result.status === "not-found") notFound();
  if (result.status === "error") throw new Error("Lectura no disponible");
  const { category, posts } = result.data;

  return (
    <>
      <SiteHeader current="blog" />
      <main className="flex flex-1 flex-col">
        <PageBanner title={category.name} />
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
          {posts.length === 0 ? (
            <p className="text-center text-lg text-muted-foreground">
              Todavía no hay entradas en esta categoría.
            </p>
          ) : (
            <PostGrid posts={posts} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
