import { createRateLimiter, type RateLimiter } from "@/lib/auth/rate-limit";

const MINUTE_MS = 60_000;

/**
 * 30 consultas cada 10 minutos por IP, contando todas (válidas o no). Mismos límites
 * que el limitador del login: en memoria, por instancia, se reinicia en frío y se
 * esquiva con muchas IPs.
 */
export function createCompatibilityLimiter(options: { now?: () => number } = {}): RateLimiter {
  return createRateLimiter({ limit: 30, windowMs: 10 * MINUTE_MS, ...options });
}
