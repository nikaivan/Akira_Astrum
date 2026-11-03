"use server";

import { redirect } from "next/navigation";
import { formDataToObject } from "@/lib/admin/form-data";
import { revalidatePublicPages } from "@/lib/admin/revalidate";
import { toActionState, type ActionState } from "@/lib/admin/state";
import { withAdminAction } from "@/lib/auth/require-admin";
import { performCreatePost, performDeletePost, performPublishPost, performUnpublishPost, performUpdatePost } from "./service";

// Cada acción vuelve a comprobar en el servidor que quien llama es admin (getUser + rol), aunque el proxy ya proteja la ruta.
// La lógica vive en ./service (sin dependencias de Next); aquí solo se lee el formulario, se invalida la caché y se responde.

const IDS_ONLY = { arrays: [] } as const;

export const createPost = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performCreatePost({ supabase, userId, input: formDataToObject(formData), now: new Date() });
  if (!result.ok) return toActionState(result);
  revalidatePublicPages();
  redirect("/admin");
});

export const updatePost = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performUpdatePost({ supabase, userId, input: formDataToObject(formData), now: new Date() });
  if (result.ok) revalidatePublicPages();
  return toActionState(result);
});

export const publishPost = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performPublishPost({ supabase, userId, input: formDataToObject(formData, IDS_ONLY), now: new Date() });
  if (result.ok) revalidatePublicPages();
  return toActionState(result);
});

export const unpublishPost = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performUnpublishPost({ supabase, userId, input: formDataToObject(formData, IDS_ONLY), now: new Date() });
  if (result.ok) revalidatePublicPages();
  return toActionState(result);
});

export const deletePost = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performDeletePost({ supabase, userId, input: formDataToObject(formData, IDS_ONLY), now: new Date() });
  if (result.ok) revalidatePublicPages();
  return toActionState(result);
});
