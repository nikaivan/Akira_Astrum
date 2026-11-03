import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { PostEditor } from "@/components/admin/post-editor";
import { listCategoryOptions } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata: Metadata = {
  title: "Nueva entrada · Akira Astrum",
  robots: { index: false, follow: false },
};

export default async function NewPostPage() {
  const { supabase } = await requireAdmin();
  const categories = await listCategoryOptions(supabase);

  return (
    <div className="grid gap-6">
      <PageHeader title="Nueva entrada" />
      <PostEditor categories={categories} imageOrigin={process.env.NEXT_PUBLIC_SUPABASE_URL} />
    </div>
  );
}
