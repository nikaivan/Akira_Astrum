import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/category-manager";
import { PageHeader } from "@/components/admin/page-header";
import { listCategoriesWithCounts } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata: Metadata = {
  title: "Categorías · Akira Astrum",
  robots: { index: false, follow: false },
};

export default async function CategoriesPage() {
  const { supabase } = await requireAdmin();
  const categories = await listCategoriesWithCounts(supabase);

  return (
    <div className="grid gap-6">
      <PageHeader title="Categorías" />
      <CategoryManager categories={categories} />
    </div>
  );
}
