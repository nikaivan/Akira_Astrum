import { clientId } from "./client-id";

export type SecurityLevel = "info" | "warn";
export type SecurityEvent = {
  ts: string;
  level: SecurityLevel;
  event: string;
  reason?: string;
  scope?: string;
  layer?: string;
  route?: string;
  user?: string;
  client?: string;
};

/** Vocabulario cerrado: cada evento admite solo estos motivos, ámbitos y capas. Lo demás no genera evento. */
const VOCABULARY: Record<string, { level: SecurityLevel; reason?: string[]; scope?: string[]; layer?: string[] }> = {
  login_succeeded: { level: "info" },
  login_failed: { level: "warn", reason: ["invalid_input", "credentials", "not_admin", "service_error"] },
  access_denied: { level: "warn", reason: ["forbidden", "service_error"], layer: ["proxy", "page"] },
  upload_rejected: { level: "warn", reason: ["rate_limited", "too_large", "invalid_content"] },
  rate_limited: { level: "warn", scope: ["login", "calculator"] },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;
const MAX_ROUTE = 100;

/** Solo la ruta: sin consulta ni hash, sin caracteres de control y relativa al sitio. Una ruta dudosa se omite. */
function cleanRoute(value: unknown): string | undefined {
  if (typeof value !== "string" || CONTROL.test(value) || !value.startsWith("/") || value.startsWith("//")) return undefined;
  const path = value.split(/[?#]/)[0] ?? "";
  return path.slice(0, MAX_ROUTE);
}

const oneOf = (value: unknown, allowed: string[] | undefined): string | undefined =>
  typeof value === "string" && allowed?.includes(value) ? value : undefined;

/**
 * Construye un evento de seguridad (A09) con una lista blanca de campos: correo, contraseña, fechas, nombres de archivo,
 * mensajes de error y cualquier otro dato se descartan. La IP se convierte en un identificador y no se guarda.
 * Devuelve null si el evento o su motivo, ámbito o capa no están en el vocabulario.
 */
export function securityEvent(input: unknown, now: () => Date = () => new Date()): SecurityEvent | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;

  const name = typeof raw.event === "string" && Object.hasOwn(VOCABULARY, raw.event) ? raw.event : undefined;
  const spec = name ? VOCABULARY[name] : undefined; // eslint-disable-line security/detect-object-injection -- `name` ya está comprobado con Object.hasOwn
  if (!name || !spec) return null;

  const reason = oneOf(raw.reason, spec.reason);
  const scope = oneOf(raw.scope, spec.scope);
  const layer = oneOf(raw.layer, spec.layer);
  if ((spec.reason && !reason) || (spec.scope && !scope) || (spec.layer && !layer)) return null;

  const route = cleanRoute(raw.route);
  const user = typeof raw.user === "string" && UUID.test(raw.user) ? raw.user : undefined;
  const client = typeof raw.ip === "string" && raw.ip !== "" ? clientId(raw.ip) : undefined;

  return {
    ts: now().toISOString(),
    level: spec.level,
    event: name,
    ...(reason && { reason }),
    ...(scope && { scope }),
    ...(layer && { layer }),
    ...(route && { route }),
    ...(user && { user }),
    ...(client && { client }),
  };
}
