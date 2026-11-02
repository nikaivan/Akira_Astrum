import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authorizeAdmin, type AdminDecision } from "@/lib/auth/authorize";
import { adminResponse } from "@/lib/auth/proxy-response";
import { authCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Capa 1 de la autorización de /admin. Es solo una capa extra: las páginas, los
 * Server Actions y los Route Handlers vuelven a comprobar con `requireAdmin`.
 */
export async function proxy(request: NextRequest) {
  let passthrough = NextResponse.next({ request });
  let decision: AdminDecision;

  try {
    const { url, anonKey } = getSupabaseEnv();
    const supabase = createServerClient(url, anonKey, {
      cookieOptions: authCookieOptions(process.env),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          passthrough = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => passthrough.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => passthrough.headers.set(name, value));
        },
      },
    });
    decision = await authorizeAdmin(supabase);
  } catch {
    decision = { status: "error" };
  }

  return adminResponse(decision, request, passthrough);
}

export const config = {
  matcher: ["/admin/:path*"],
};
