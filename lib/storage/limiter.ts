import { createRateLimiter, type RateLimiter } from "@/lib/auth/rate-limit";

/** 20 intentos de subida cada 10 minutos por admin (los rechazados también cuentan). En memoria y por instancia (ADR 0011). */
export const UPLOAD_LIMIT = 20;
export const UPLOAD_WINDOW_MS = 10 * 60_000;

export function createUploadLimiter(options: { now?: () => number } = {}): RateLimiter {
  return createRateLimiter({ limit: UPLOAD_LIMIT, windowMs: UPLOAD_WINDOW_MS, ...options });
}
