import { NextResponse, type NextRequest } from "next/server";
import type { AdminDecision } from "./authorize";
import { PRIVATE_HEADERS } from "./private-headers";
import { safeAdminPath } from "./redirect";

function carryOver(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(name);
    if (value) to.headers.set(name, value);
  }
}

function sealed(response: NextResponse): NextResponse {
  for (const { key, value } of PRIVATE_HEADERS) response.headers.set(key, value);
  return response;
}

/** Traduce la decisión de autorización en la respuesta del proxy para `/admin/*`. */
export function adminResponse(decision: AdminDecision, request: NextRequest, passthrough: NextResponse): NextResponse {
  switch (decision.status) {
    case "allow":
      return sealed(passthrough);
    case "unauthenticated": {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", safeAdminPath(`${request.nextUrl.pathname}${request.nextUrl.search}`));
      const response = NextResponse.redirect(login, 307);
      carryOver(passthrough, response);
      return sealed(response);
    }
    case "forbidden": {
      const response = new NextResponse("Acceso denegado.", { status: 403 });
      carryOver(passthrough, response);
      return sealed(response);
    }
    default:
      return sealed(new NextResponse("Servicio no disponible.", { status: 503 }));
  }
}
