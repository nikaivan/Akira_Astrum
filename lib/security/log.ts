import { securityEvent, type SecurityLevel } from "./events";

type Sink = (line: string, level: SecurityLevel) => void;
let sink: Sink | null = null;

/** Sustituye el destino del registro (lo usan los tests); `null` restaura el de por defecto. */
export function setSecuritySink(next: Sink | null): void {
  sink = next;
}

/**
 * Registra un evento de seguridad (A09) como una línea JSON en la salida del servidor (Vercel la recoge). Nunca lanza ni
 * cambia el resultado de quien lo llama: si el evento no es válido o el destino falla, no pasa nada. En los tests es
 * silencioso salvo que se instale un destino. Es el único archivo de la aplicación que escribe en la consola.
 */
export function recordSecurityEvent(input: unknown): void {
  try {
    const event = securityEvent(input);
    if (!event) return;
    const line = JSON.stringify(event);
    if (sink) sink(line, event.level);
    else if (process.env.NODE_ENV !== "test") (event.level === "warn" ? console.warn : console.info)(line);
  } catch {
    // El registro nunca debe afectar a la petición.
  }
}
