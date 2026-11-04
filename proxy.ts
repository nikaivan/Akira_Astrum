import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { recordAccessDenied } from "@/lib/auth/access-denied";
import { authorizeAdmin, type AdminDecision } from "@/lib/auth/authorize";
import { adminResponse } from "@/lib/auth/proxy-response";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import { authCookieOptions, enforceSessionCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** Política de esta petición; el nonce se reenvía a la renderización para que Next marque sus scripts y estilos. */
function withCsp(request: NextRequest) {
  const nonce = generateNonce();
  const policy = buildCsp({ nonce, isDev: process.env.NODE_ENV === "development", storageOrigin: process.env.NEXT_PUBLIC_SUPABASE_URL });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);
  return { policy, headers };
}

function secured(response: NextResponse, policy: string): NextResponse {
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

/**
 * Pone la CSP con nonce en todas las páginas y, en /admin, es la capa 1 de la autorización. Es solo una capa
 * extra: las páginas, los Server Actions y los Route Handlers vuelven a comprobar con `requireAdmin`.
 */
export async function proxy(request: NextRequest) {
  const { policy, headers } = withCsp(request);
  if (!request.nextUrl.pathname.startsWith("/admin")) return secured(NextResponse.next({ request: { headers } }), policy);

  let passthrough = NextResponse.next({ request: { headers } });
  let decision: AdminDecision;

  try {
    const { url, anonKey } = getSupabaseEnv();
    const supabase = createServerClient(url, anonKey, {
      cookieOptions: authCookieOptions(process.env),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, responseHeaders) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          passthrough = NextResponse.next({ request: { headers } });
          cookiesToSet.forEach(({ name, value, options }) => passthrough.cookies.set(name, value, enforceSessionCookieOptions(options, process.env)));
          Object.entries(responseHeaders).forEach(([name, value]) => passthrough.headers.set(name, value));
        },
      },
    });
    decision = await authorizeAdmin(supabase);
  } catch {
    decision = { status: "error" };
  }

  recordAccessDenied(decision, "proxy", request.nextUrl.pathname);

  return secured(adminResponse(decision, request, passthrough), policy);
}

export const config = {
  matcher: [
    "/admin/:path*",
    {
      // Todas las páginas, salvo los estáticos de Next; las precargas de next/link no necesitan nonce.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
