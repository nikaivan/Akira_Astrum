"use server";

import { formDataToObject } from "@/lib/admin/form-data";
import { revalidatePublicPages } from "@/lib/admin/revalidate";
import { toActionState, type ActionState } from "@/lib/admin/state";
import { withAdminAction } from "@/lib/auth/require-admin";
import { performCreateCategory, performDeleteCategory, performRenameCategory } from "./service";

const NO_ARRAYS = { arrays: [] } as const;

export const createCategory = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performCreateCategory({ supabase, userId, input: formDataToObject(formData, NO_ARRAYS) });
  if (result.ok) revalidatePublicPages();
  return toActionState(result);
});

export const renameCategory = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performRenameCategory({ supabase, userId, input: formDataToObject(formData, NO_ARRAYS) });
  if (result.ok) revalidatePublicPages();
  return toActionState(result);
});

export const deleteCategory = withAdminAction(async ({ supabase, userId }, _previous: ActionState, formData: FormData): Promise<ActionState> => {
  const result = await performDeleteCategory({ supabase, userId, input: formDataToObject(formData, NO_ARRAYS) });
  if (result.ok) revalidatePublicPages();
  return toActionState(result);
});
