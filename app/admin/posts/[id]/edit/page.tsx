import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PostEditor } from "@/components/admin/post-editor";
import { getAdminPost, listCategoryOptions } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata: Metadata = {
  title: "Editar entrada · Akira Astrum",
  robots: { index: false, follow: false },
};

export default async function EditPostPage({ params }: PageProps<"/admin/posts/[id]/edit">) {
  const { supabase } = await requireAdmin();
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();

  const [post, categories] = await Promise.all([getAdminPost(supabase, parsed.data), listCategoryOptions(supabase)]);
  if (!post) notFound();

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Editar entrada</h1>
      <PostEditor post={post} categories={categories} imageOrigin={process.env.NEXT_PUBLIC_SUPABASE_URL} />
    </div>
  );
}
