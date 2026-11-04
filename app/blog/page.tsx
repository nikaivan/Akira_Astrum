import type { Metadata } from "next";
import { PageBanner } from "@/components/page-banner";
import { PostGrid } from "@/components/post-grid";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { container } from "@/components/ui/surface-styles";
import { pageTitle } from "@/lib/blog/metadata";
import { listPublishedPosts } from "@/lib/blog/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { cn } from "@/lib/utils";

// Siempre dinámica: nada de esta página se guarda en caché.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: pageTitle("Blog"),
  description: "Todas las entradas del blog de astrología de Akira Astrum.",
};

const MAX_ENTRIES = 50;

export default async function BlogPage() {
  const result = await listPublishedPosts(createPublicClient(), {
    limit: MAX_ENTRIES,
    origin: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  if (result.status !== "ok") throw new Error("Lectura no disponible");

  return (
    <>
      <SiteHeader current="blog" />
      <main className="flex flex-1 flex-col">
        <PageBanner title="Blog" />
        <div className={cn(container.wide, "flex flex-1 flex-col gap-8 py-12")}>
          {result.data.length === 0 ? (
            <p className="text-center text-lg text-muted-foreground">
              Todavía no hay entradas.
            </p>
          ) : (
            <PostGrid posts={result.data} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
