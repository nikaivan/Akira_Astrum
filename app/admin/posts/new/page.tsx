import type { Metadata } from "next";
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
      <h1 className="text-2xl font-semibold">Nueva entrada</h1>
      <PostEditor categories={categories} imageOrigin={process.env.NEXT_PUBLIC_SUPABASE_URL} />
    </div>
  );
}
