import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PostArticle } from "@/components/post-article";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { container } from "@/components/ui/surface-styles";
import { postMetadata } from "@/lib/blog/metadata";
import { getPublishedPost } from "@/lib/blog/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { cn } from "@/lib/utils";

// Siempre dinámica: un borrador o una entrada despublicada no se puede servir desde ninguna copia.
export const dynamic = "force-dynamic";

// Una sola lectura por petición (la comparten la página y sus metadatos); no se guarda entre peticiones.
const load = cache((slug: string) => getPublishedPost(createPublicClient(), slug, { origin: process.env.NEXT_PUBLIC_SUPABASE_URL }));

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const result = await load((await params).slug);
  if (result.status === "not-found") notFound();
  if (result.status === "error") throw new Error("Lectura no disponible");
  return postMetadata(result.data);
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const result = await load((await params).slug);
  if (result.status === "not-found") notFound();
  if (result.status === "error") throw new Error("Lectura no disponible");

  return (
    <>
      <SiteHeader current="blog" />
      <main className={cn(container.reading, "flex-1 py-12")}>
        <PostArticle post={result.data} imageOrigin={process.env.NEXT_PUBLIC_SUPABASE_URL} />
      </main>
      <SiteFooter />
    </>
  );
}
