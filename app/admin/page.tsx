import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { PostFilters } from "@/components/admin/post-filters";
import { PostList } from "@/components/admin/post-list";
import { primaryButton } from "@/components/admin/styles";
import { parseListFilters } from "@/lib/admin/posts/filters";
import { listAdminPosts, listCategoryOptions } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/require-admin";

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
      <PageHeader title="Panel de administración">
        <Link href="/admin/posts/new" className={primaryButton}>
          Nueva entrada
        </Link>
      </PageHeader>
      <PostFilters status={filters.status} category={filters.category} categories={categories} />
      <PostList posts={posts} />
    </div>
  );
}
