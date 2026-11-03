"use server";

import { redirect } from "next/navigation";
import { formDataToObject } from "@/lib/admin/form-data";
import { settleAndRevalidate } from "@/lib/admin/revalidate";
import type { ActionState } from "@/lib/admin/state";
import { withAdminAction } from "@/lib/auth/require-admin";
import { createUploadLimiter } from "@/lib/storage/limiter";
import { performCreatePost, performDeletePost, performPublishPost, performUnpublishPost, performUpdatePost } from "./service";

// Cada acción vuelve a comprobar en el servidor que quien llama es admin (getUser + rol), aunque el proxy ya proteja la ruta.
// La lógica vive en ./service (sin dependencias de Next); aquí solo se lee el formulario, se invalida la caché y se responde.

const IDS_ONLY = { arrays: [] } as const;

// Frena las subidas masivas de portadas (20 cada 10 minutos por admin). En memoria y por instancia: ver ADR 0011.
const uploadLimiter = createUploadLimiter();

export const createPost = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performCreatePost({ supabase, userId, input: formDataToObject(formData), now: new Date(), limiter: uploadLimiter });
  const state = settleAndRevalidate(result);
  if (!result.ok) return state;
  redirect("/admin");
});

export const updatePost = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performUpdatePost({ supabase, userId, input: formDataToObject(formData), now: new Date(), limiter: uploadLimiter });
  return settleAndRevalidate(result);
});

export const publishPost = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performPublishPost({ supabase, userId, input: formDataToObject(formData, IDS_ONLY), now: new Date() });
  return settleAndRevalidate(result);
});

export const unpublishPost = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performUnpublishPost({ supabase, userId, input: formDataToObject(formData, IDS_ONLY), now: new Date() });
  return settleAndRevalidate(result);
});

export const deletePost = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performDeletePost({ supabase, userId, input: formDataToObject(formData, IDS_ONLY), now: new Date() });
  return settleAndRevalidate(result);
});
