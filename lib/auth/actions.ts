"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { performLogin, type LoginResult, type LoginState } from "./login";
import { GENERIC_LOGIN_ERROR } from "./messages";
import { clientIpFrom, createRateLimiter } from "./rate-limit";

const limiter = createRateLimiter();

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  let result: LoginResult;
  try {
    const supabase = await createClient();
    const ip = clientIpFrom(await headers());
    result = await performLogin({ supabase, limiter, ip, formData });
  } catch {
    result = { ok: false, message: GENERIC_LOGIN_ERROR };
  }
  if (!result.ok) return { message: result.message };
  redirect(result.redirectTo);
}

export async function logout(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Aun así se vuelve a /login; sin sesión válida el proxy no deja pasar.
  }
  redirect("/login");
}
