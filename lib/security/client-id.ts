import { createHash, randomUUID } from "node:crypto";

// Sal aleatoria de esta instancia: cambia en cada arranque, así que el identificador no se puede revertir a la IP
// ni seguir entre arranques (A09 sin datos personales). Sirve para ver «el mismo cliente» dentro de una instancia.
const SALT = randomUUID();

/** Identificador de 12 caracteres hexadecimales del cliente; nunca contiene la IP. */
export function clientId(ip: string): string {
  return createHash("sha256").update(`${SALT}:${ip}`).digest("hex").slice(0, 12);
}
