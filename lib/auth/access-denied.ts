import { recordSecurityEvent } from "@/lib/security/log";
import type { AdminDecision } from "./authorize";

/**
 * Registra una denegación de acceso a /admin (A09), venga del proxy o de la capa 2. Sin sesión no es un evento: cada visita
 * anónima a /admin es normal y llenaría el registro. Solo cuentan un no admin y un fallo del servicio.
 */
export function recordAccessDenied(decision: AdminDecision, layer: "proxy" | "page", route?: string): void {
  if (decision.status !== "forbidden" && decision.status !== "error") return;
  recordSecurityEvent({ event: "access_denied", reason: decision.status === "forbidden" ? "forbidden" : "service_error", layer, route });
}
