import type { Metadata } from "next";
import Link from "next/link";
import { PostFilters } from "@/components/admin/post-filters";
import { PostList } from "@/components/admin/post-list";
import { buttonVariants } from "@/components/ui/button";
import { parseListFilters } from "@/lib/admin/posts/filters";
import { listAdminPosts, listCategoryOptions } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/require-admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Entradas · Akira Astrum",
  robots: { index: false, follow: false },
};

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const { supabase } = await requireAdmin();
  const filters = parseListFilters(await searchParams);
  const [posts, categories] = await Promise.all([listAdminPosts(supabase, filters), listCategoryOptions(supabase)]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Panel de administración</h1>
        <Link href="/admin/posts/new" className={cn(buttonVariants(), "h-11 px-4")}>
          Nueva entrada
        </Link>
      </div>
      <PostFilters status={filters.status} category={filters.category} categories={categories} />
      <PostList posts={posts} />
    </div>
  );
}
